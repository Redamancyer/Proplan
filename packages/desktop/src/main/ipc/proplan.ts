import path from 'path'
import { createHash, randomUUID } from 'crypto'
import { fileURLToPath, pathToFileURL } from 'url'
import fs from 'fs-extra'
import writeFileAtomic from 'write-file-atomic'
import { app, BrowserWindow, dialog, ipcMain, net, shell } from 'electron'
import type { IpcMainEvent } from 'electron'
import { getCurrentLanguage } from '../i18n'
import {
  LEGACY_PROPLAN_BACKUP_FILENAME,
  LEGACY_PROPLAN_DATA_FILENAME,
  PROPLAN_DATABASE_FILENAME,
  isProplanDatabaseInitialized,
  readProplanDatabase,
  writeProplanDatabase
} from '../database/proplan'
import {
  createEmptyProplanDatabase,
  type ProplanBackupResult,
  type ProplanDatabase,
  type ProplanImageImportResult,
  type ProplanImageSource,
  type ProplanMemo,
  type ProplanProject,
  type ProplanRestoreRequest,
  type ProplanRestoreResult,
  type ProplanTask,
  type ProplanTimelineEntry
} from '@shared/types/proplan'

const ASSETS_DIRNAME = 'proplan-assets'
const BACKUP_FORMAT = 'proplan-backup'
const BACKUP_VERSION = 1
const BACKUP_EXTENSION = 'proplan-backup'
const PREFERENCES_FILENAME = 'preferences.json'
const SAFETY_BACKUP_FILENAME = 'proplan-before-restore.proplan-backup'
const MAX_IMAGE_BYTES = 20 * 1024 * 1024
const MAX_BACKUP_BYTES = 1024 * 1024 * 1024
const REMOTE_IMAGE_TIMEOUT = 30_000
const ASSET_CLEANUP_DELAY = 5_000
const EDITOR_FLUSH_TIMEOUT = 10_000
const COLORS = new Set(['#4f7c6a', '#476d8c', '#8b6755', '#806790', '#9a7440', '#5f6b72'])
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'])
const EXTENSION_BY_MIME = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/gif', 'gif'],
  ['image/svg+xml', 'svg'],
  ['image/webp', 'webp']
])
const pendingAssetFilenames = new Set<string>()
const localized = (zh: string, en: string): string =>
  getCurrentLanguage().toLowerCase().startsWith('zh') ? zh : en

interface ProplanBackupAsset {
  filename: string
  data: string
  sha256: string
}

interface ProplanBackupDocument {
  format: typeof BACKUP_FORMAT
  version: typeof BACKUP_VERSION
  createdAt: string
  appVersion: string
  sourceAssetsPath: string
  sourceAssetsUrl: string
  database: ProplanDatabase
  preferences: Record<string, unknown>
  assets: ProplanBackupAsset[]
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const sanitizeBackupPreferences = (preferences: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(preferences).filter(([key]) => key !== '__internal__'))

const stringValue = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback

const nullableString = (value: unknown): string | null => (typeof value === 'string' ? value : null)

const invalidDatabase = (detail: string): never => {
  throw new Error(localized(`Proplan 数据格式无效：${detail}`, `Invalid Proplan data: ${detail}`))
}

const requiredId = (value: unknown, detail: string): string => {
  if (typeof value === 'string' && value.length > 0) return value
  return invalidDatabase(detail)
}

function assertObject(value: unknown, detail: string): asserts value is Record<string, unknown> {
  if (!isObject(value)) invalidDatabase(detail)
}

function assertArray(value: unknown, detail: string): asserts value is unknown[] {
  if (!Array.isArray(value)) invalidDatabase(detail)
}

const normalizeMemo = (value: unknown, context: string): ProplanMemo => {
  assertObject(value, localized(`${context} 不是对象`, `${context} is not an object`))
  const id = requiredId(value.id, localized(`${context} 缺少有效 ID`, `${context} has no valid ID`))
  const createdAt = stringValue(value.createdAt, new Date().toISOString())
  return {
    id,
    title: stringValue(value.title, localized('未命名备忘', 'Untitled memo')),
    markdown: stringValue(value.markdown),
    createdAt,
    updatedAt: stringValue(value.updatedAt, createdAt)
  }
}

const normalizeTask = (value: unknown, context: string): ProplanTask => {
  const memo = normalizeMemo(value, context)
  assertObject(value, localized(`${context} 不是对象`, `${context} is not an object`))
  return {
    ...memo,
    completed: value.completed === true,
    dueAt: nullableString(value.dueAt),
    completedAt: nullableString(value.completedAt)
  }
}

const normalizeTimelineEntry = (value: unknown, context: string): ProplanTimelineEntry => {
  const memo = normalizeMemo(value, context)
  assertObject(value, localized(`${context} 不是对象`, `${context} is not an object`))
  return { ...memo, occurredAt: stringValue(value.occurredAt, memo.createdAt.slice(0, 10)) }
}

const normalizeProject = (value: unknown, projectIndex: number): ProplanProject => {
  const context = localized(`项目 ${projectIndex + 1}`, `Project ${projectIndex + 1}`)
  assertObject(value, localized(`${context} 不是对象`, `${context} is not an object`))
  const id = requiredId(value.id, localized(`${context} 缺少有效 ID`, `${context} has no valid ID`))
  const createdAt = stringValue(value.createdAt, new Date().toISOString())
  const normalizeList = <T>(
    input: unknown,
    section: string,
    normalize: (entry: unknown, entryContext: string) => T
  ): T[] => {
    assertArray(
      input,
      localized(`${context}的${section}列表无效`, `${context} has an invalid ${section} list`)
    )
    return input.map((entry, index) =>
      normalize(entry, localized(`${context}的${section} ${index + 1}`, `${context} ${section} ${index + 1}`))
    )
  }
  const color = stringValue(value.color)
  return {
    id,
    name: stringValue(value.name, localized('未命名项目', 'Untitled project')),
    description: stringValue(value.description),
    color: COLORS.has(color) ? color : '#4f7c6a',
    createdAt,
    updatedAt: stringValue(value.updatedAt, createdAt),
    memos: normalizeList(value.memos, localized('备忘', 'memo'), normalizeMemo),
    tasks: normalizeList(value.tasks, localized('任务', 'task'), normalizeTask),
    timeline: normalizeList(value.timeline, localized('时间轴', 'timeline entry'), normalizeTimelineEntry)
  }
}

export const normalizeProplanDatabase = (value: unknown): ProplanDatabase => {
  assertObject(value, localized('根节点不是对象', 'Root value is not an object'))
  if (value.version !== 1) {
    invalidDatabase(localized('缺少版本或项目列表', 'Missing version or project list'))
  }
  assertArray(value.projects, localized('缺少版本或项目列表', 'Missing version or project list'))
  const projects = value.projects.map(normalizeProject)
  const projectIds = new Set<string>()
  const recordIds = new Set<string>()
  for (const project of projects) {
    if (projectIds.has(project.id)) {
      invalidDatabase(localized(`项目 ID 重复：${project.id}`, `Duplicate project ID: ${project.id}`))
    }
    projectIds.add(project.id)
    for (const record of [...project.memos, ...project.tasks, ...project.timeline]) {
      if (recordIds.has(record.id)) {
        invalidDatabase(localized(`记录 ID 重复：${record.id}`, `Duplicate record ID: ${record.id}`))
      }
      recordIds.add(record.id)
    }
  }
  const taskIds = new Set(projects.flatMap((project) => project.tasks.map((task) => task.id)))
  const requestedOrder = Array.isArray(value.globalTaskOrder)
    ? value.globalTaskOrder.filter((id): id is string => typeof id === 'string')
    : []
  const globalTaskOrder = [...new Set(requestedOrder)].filter((id) => taskIds.has(id))
  for (const project of projects) {
    for (const task of project.tasks) {
      if (!globalTaskOrder.includes(task.id)) globalTaskOrder.push(task.id)
    }
  }
  return {
    version: 1,
    projects,
    globalTaskOrder
  }
}

const getDataPath = (): string => path.join(app.getPath('userData'), PROPLAN_DATABASE_FILENAME)
const getLegacyDataPath = (): string =>
  path.join(app.getPath('userData'), LEGACY_PROPLAN_DATA_FILENAME)
const getLegacyBackupPath = (): string =>
  path.join(app.getPath('userData'), LEGACY_PROPLAN_BACKUP_FILENAME)
const getAssetsPath = (): string => path.join(app.getPath('userData'), ASSETS_DIRNAME)

const assertImageBytes = (data: Buffer, extension: string): void => {
  const ascii = data.subarray(0, 512).toString('utf8').trimStart().toLowerCase()
  const valid =
    extension === 'png'
      ? data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      : extension === 'jpg' || extension === 'jpeg'
        ? data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff
        : extension === 'gif'
          ? data.subarray(0, 6).toString('ascii') === 'GIF87a' ||
            data.subarray(0, 6).toString('ascii') === 'GIF89a'
          : extension === 'webp'
            ? data.subarray(0, 4).toString('ascii') === 'RIFF' &&
              data.subarray(8, 12).toString('ascii') === 'WEBP'
            : extension === 'svg'
              ? ascii.startsWith('<svg') || (ascii.startsWith('<?xml') && ascii.includes('<svg'))
              : false

  if (!valid) throw new Error(localized('文件内容不是受支持的图片格式', 'Unsupported image content'))
}

const readBoundedResponse = async(response: Response): Promise<Buffer> => {
  const declaredSize = Number(response.headers.get('content-length') ?? 0)
  if (Number.isFinite(declaredSize) && declaredSize > MAX_IMAGE_BYTES) {
    throw new Error(localized('图片不能超过 20 MB', 'Images cannot exceed 20 MB'))
  }
  if (!response.body) throw new Error(localized('图片下载结果为空', 'The image download was empty'))

  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_IMAGE_BYTES) {
      await reader.cancel()
      throw new Error(localized('图片不能超过 20 MB', 'Images cannot exceed 20 MB'))
    }
    chunks.push(Buffer.from(value))
  }
  return Buffer.concat(chunks, total)
}

export const readLocalImage = async(
  sourcePath: string
): Promise<{ data: Buffer; extension: string }> => {
  const localPath = sourcePath.startsWith('file://') ? fileURLToPath(sourcePath) : sourcePath
  const stats = await fs.stat(localPath)
  if (!stats.isFile()) throw new Error(localized('选择的路径不是文件', 'The selected path is not a file'))
  if (stats.size > MAX_IMAGE_BYTES) {
    throw new Error(localized('图片不能超过 20 MB', 'Images cannot exceed 20 MB'))
  }
  const extension = path.extname(localPath).slice(1).toLowerCase()
  if (!IMAGE_EXTENSIONS.has(extension)) {
    throw new Error(localized('不支持该图片格式', 'Unsupported image format'))
  }
  const data = await fs.readFile(localPath)
  assertImageBytes(data, extension)
  return { data, extension: extension === 'jpeg' ? 'jpg' : extension }
}

export const downloadRemoteImage = async(
  url: string
): Promise<{ data: Buffer; extension: string }> => {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(localized('图片链接无效', 'Invalid image URL'))
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(localized('图片链接只支持 http 或 https', 'Image URLs must use HTTP or HTTPS'))
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REMOTE_IMAGE_TIMEOUT)
  try {
    const response = await net.fetch(parsed.toString(), {
      redirect: 'follow',
      signal: controller.signal
    })
    if (!response.ok) {
      throw new Error(
        localized(`图片下载失败（HTTP ${response.status}）`, `Image download failed (HTTP ${response.status})`)
      )
    }

    // Electron's net.fetch may leave Response.url empty even after a successful request.
    const finalUrl = response.url || parsed.toString()
    const finalProtocol = new URL(finalUrl).protocol
    if (finalProtocol !== 'http:' && finalProtocol !== 'https:') {
      throw new Error(
        localized('图片下载重定向到了不安全的地址', 'The image download redirected to an unsafe URL')
      )
    }
    const mime = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? ''
    const extension = EXTENSION_BY_MIME.get(mime)
    if (!extension) {
      throw new Error(localized('链接返回的内容不是受支持的图片', 'The URL did not return a supported image'))
    }
    const data = await readBoundedResponse(response)
    assertImageBytes(data, extension)
    return { data, extension }
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(localized('图片下载超时，请稍后重试', 'Image download timed out. Please try again'))
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export const readDataImage = (dataUrl: string): { data: Buffer; extension: string } => {
  const match = /^data:(image\/(?:jpeg|png|gif|svg\+xml|webp));base64,([a-z0-9+/=\r\n]+)$/i.exec(
    dataUrl
  )
  if (!match) throw new Error(localized('粘贴的图片数据无效', 'Invalid pasted image data'))
  const [, mime, payload] = match
  if (!mime || !payload) throw new Error(localized('粘贴的图片数据无效', 'Invalid pasted image data'))
  const extension = EXTENSION_BY_MIME.get(mime.toLowerCase())
  if (!extension) throw new Error(localized('不支持该图片格式', 'Unsupported image format'))
  const data = Buffer.from(payload, 'base64')
  if (data.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(localized('图片不能超过 20 MB', 'Images cannot exceed 20 MB'))
  }
  assertImageBytes(data, extension)
  return { data, extension }
}

const chooseLocalImage = async(event: Electron.IpcMainInvokeEvent): Promise<string | null> => {
  const owner = BrowserWindow.fromWebContents(event.sender)
  const options: Electron.OpenDialogOptions = {
    title: localized('选择图片', 'Choose an image'),
    properties: ['openFile'],
    filters: [{ name: localized('图片', 'Images'), extensions: [...IMAGE_EXTENSIONS] }]
  }
  const result = owner
    ? await dialog.showOpenDialog(owner, options)
    : await dialog.showOpenDialog(options)
  return result.canceled ? null : (result.filePaths[0] ?? null)
}

export const importImage = async(
  event: Electron.IpcMainInvokeEvent,
  source: ProplanImageSource
): Promise<ProplanImageImportResult | null> => {
  let image: { data: Buffer; extension: string }
  if (source.kind === 'local') {
    const sourcePath = source.path || (await chooseLocalImage(event))
    if (!sourcePath) return null
    const localPath = sourcePath.startsWith('file://') ? fileURLToPath(sourcePath) : sourcePath
    const assetsRoot = getAssetsPath()
    const relative = path.relative(assetsRoot, localPath)
    if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
      const stats = await fs.stat(localPath)
      if (stats.isFile()) {
        pendingAssetFilenames.add(path.basename(localPath))
        return { url: pathToFileURL(localPath).href, filename: path.basename(localPath) }
      }
    }
    image = await readLocalImage(sourcePath)
  } else if (source.kind === 'remote') {
    image = await downloadRemoteImage(source.url)
  } else if (source.kind === 'data') {
    image = readDataImage(source.dataUrl)
  } else {
    throw new Error(localized('不支持的图片来源', 'Unsupported image source'))
  }

  const filename = `${randomUUID()}.${image.extension}`
  const assetsRoot = getAssetsPath()
  const destination = path.join(assetsRoot, filename)
  await fs.ensureDir(assetsRoot)
  pendingAssetFilenames.add(filename)
  try {
    await fs.writeFile(destination, image.data, { flag: 'wx' })
  } catch (error) {
    pendingAssetFilenames.delete(filename)
    throw error
  }
  return { url: pathToFileURL(destination).href, filename }
}

const allRecords = (database: ProplanDatabase) =>
  database.projects.flatMap((project) => [...project.memos, ...project.tasks, ...project.timeline])

const allMarkdown = (database: ProplanDatabase): string =>
  allRecords(database)
    .map((record) => record.markdown)
    .join('\n')

const isReferenced = (markdown: string, filename: string): boolean => {
  const url = pathToFileURL(filename).href
  return markdown.includes(url) || markdown.includes(filename)
}

export const cleanupUnreferencedAssets = async(markdown: string): Promise<void> => {
  const assetsRoot = getAssetsPath()
  if (!(await fs.pathExists(assetsRoot))) return

  const cleanupDirectory = async(directory: string): Promise<void> => {
    const entries = await fs.readdir(directory)
    for (const entry of entries) {
      const entryPath = path.join(directory, entry)
      const relative = path.relative(assetsRoot, entryPath)
      if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) continue
      const stats = await fs.lstat(entryPath)
      if (stats.isSymbolicLink()) continue
      if (stats.isDirectory()) {
        await cleanupDirectory(entryPath)
        if ((await fs.readdir(entryPath)).length === 0) await fs.rmdir(entryPath)
      } else if (
        stats.isFile() &&
        !pendingAssetFilenames.has(path.basename(entryPath)) &&
        !isReferenced(markdown, entryPath)
      ) {
        await fs.unlink(entryPath)
      }
    }
  }

  await cleanupDirectory(assetsRoot)
}

export const flattenManagedAssets = async(database: ProplanDatabase): Promise<ProplanDatabase> => {
  const assetsRoot = getAssetsPath()
  if (!(await fs.pathExists(assetsRoot))) return database

  const migrated = normalizeProplanDatabase(database)
  const copiedFiles: Array<{ source: string; destination: string }> = []
  const recordDirectories: string[] = []

  try {
    for (const entry of await fs.readdir(assetsRoot)) {
      const directory = path.join(assetsRoot, entry)
      const stats = await fs.lstat(directory)
      if (!stats.isDirectory() || stats.isSymbolicLink()) continue
      recordDirectories.push(directory)

      for (const filename of await fs.readdir(directory)) {
        const source = path.join(directory, filename)
        const fileStats = await fs.lstat(source)
        if (!fileStats.isFile() || fileStats.isSymbolicLink()) continue

        let destination = path.join(assetsRoot, filename)
        if (await fs.pathExists(destination)) {
          destination = path.join(assetsRoot, `${randomUUID()}${path.extname(filename)}`)
        }
        await fs.copy(source, destination, { overwrite: false, errorOnExist: true })
        copiedFiles.push({ source, destination })
      }
    }
  } catch (error) {
    await Promise.all(copiedFiles.map(({ destination }) => fs.remove(destination)))
    throw error
  }

  if (!copiedFiles.length) return database

  for (const record of allRecords(migrated)) {
    for (const { source, destination } of copiedFiles) {
      record.markdown = record.markdown
        .split(pathToFileURL(source).href)
        .join(pathToFileURL(destination).href)
        .split(source)
        .join(destination)
    }
  }

  writeProplanDatabase(getDataPath(), migrated)
  await Promise.all(copiedFiles.map(({ source }) => fs.remove(source)))
  for (const directory of recordDirectories) {
    if ((await fs.readdir(directory)).length === 0) await fs.rmdir(directory)
  }

  return migrated
}

let saveQueue: Promise<void> = Promise.resolve()
let cleanupTimer: ReturnType<typeof setTimeout> | null = null
let restoreInProgress = false

const scheduleAssetCleanup = (database: ProplanDatabase): void => {
  if (cleanupTimer) clearTimeout(cleanupTimer)
  const markdown = allMarkdown(database)
  cleanupTimer = setTimeout(() => {
    cleanupTimer = null
    cleanupUnreferencedAssets(markdown).catch(() => undefined)
  }, ASSET_CLEANUP_DELAY)
}

export const loadDatabase = async(): Promise<ProplanDatabase> => {
  const dataPath = getDataPath()
  const legacyDataPath = getLegacyDataPath()
  if (!isProplanDatabaseInitialized(dataPath)) {
    let initialDatabase = createEmptyProplanDatabase()
    if (await fs.pathExists(legacyDataPath)) {
      const source = await fs.readFile(legacyDataPath, 'utf8')
      initialDatabase = normalizeProplanDatabase(JSON.parse(source) as unknown)
    }
    writeProplanDatabase(dataPath, initialDatabase)
    if (await fs.pathExists(legacyDataPath)) {
      const legacyBackupPath = getLegacyBackupPath()
      if (!(await fs.pathExists(legacyBackupPath))) {
        await fs.move(legacyDataPath, legacyBackupPath, { overwrite: false })
      } else {
        await fs.remove(legacyDataPath)
      }
    }
  }
  let database = normalizeProplanDatabase(readProplanDatabase(dataPath))
  try {
    database = await flattenManagedAssets(database)
  } catch (error) {
    console.warn('Unable to flatten managed Proplan images:', error)
  }
  scheduleAssetCleanup(database)
  return database
}

const saveDatabase = (database: ProplanDatabase): Promise<void> => {
  if (restoreInProgress) {
    return Promise.reject(
      new Error(localized('正在恢复备份，请稍候', 'A backup is being restored. Please wait'))
    )
  }
  const normalized = normalizeProplanDatabase(database)
  saveQueue = saveQueue
    .catch(() => undefined)
    .then(async() => {
      writeProplanDatabase(getDataPath(), normalized)
      const markdown = allMarkdown(normalized)
      for (const filename of pendingAssetFilenames) {
        if (isReferenced(markdown, path.join(getAssetsPath(), filename))) {
          pendingAssetFilenames.delete(filename)
        }
      }
      scheduleAssetCleanup(normalized)
    })
  return saveQueue
}

const readStoredDatabase = async(): Promise<ProplanDatabase> => {
  const dataPath = getDataPath()
  if (!isProplanDatabaseInitialized(dataPath)) return loadDatabase()
  return normalizeProplanDatabase(readProplanDatabase(dataPath))
}

const readStoredPreferences = async(): Promise<Record<string, unknown>> => {
  const preferencesPath = path.join(app.getPath('userData'), PREFERENCES_FILENAME)
  if (!(await fs.pathExists(preferencesPath))) return {}
  const value = JSON.parse(await fs.readFile(preferencesPath, 'utf8')) as unknown
  if (!isObject(value)) {
    throw new Error(
      localized(
        '偏好设置文件无效，无法创建完整备份',
        'The preferences file is invalid, so a complete backup cannot be created'
      )
    )
  }
  return sanitizeBackupPreferences(value)
}

const collectBackupAssets = async(): Promise<ProplanBackupAsset[]> => {
  const assetsRoot = getAssetsPath()
  if (!(await fs.pathExists(assetsRoot))) return []
  const assets: ProplanBackupAsset[] = []
  for (const entry of await fs.readdir(assetsRoot, { withFileTypes: true })) {
    if (!entry.isFile() || entry.isSymbolicLink()) continue
    const extension = path.extname(entry.name).slice(1).toLowerCase()
    if (!IMAGE_EXTENSIONS.has(extension)) continue
    const sourcePath = path.join(assetsRoot, entry.name)
    const stats = await fs.stat(sourcePath)
    if (stats.size > MAX_IMAGE_BYTES) {
      throw new Error(
        localized(`图片 ${entry.name} 超过 20 MB`, `Image ${entry.name} exceeds 20 MB`)
      )
    }
    const data = await fs.readFile(sourcePath)
    assertImageBytes(data, extension)
    assets.push({
      filename: entry.name,
      data: data.toString('base64'),
      sha256: createHash('sha256').update(data).digest('hex')
    })
  }
  return assets.sort((a, b) => a.filename.localeCompare(b.filename))
}

const createBackupDocument = async(): Promise<ProplanBackupDocument> => {
  const assetsRoot = getAssetsPath()
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    appVersion: app.getVersion(),
    sourceAssetsPath: assetsRoot,
    sourceAssetsUrl: pathToFileURL(assetsRoot).href,
    database: await readStoredDatabase(),
    preferences: await readStoredPreferences(),
    assets: await collectBackupAssets()
  }
}

const encodeBackupDocument = (backup: ProplanBackupDocument): string =>
  `${JSON.stringify(backup, null, 2)}\n`

const editorWindow = (): BrowserWindow | null => {
  const windows = BrowserWindow.getAllWindows()
    .filter((window) => {
      if (window.isDestroyed()) return false
      try {
        return new URL(window.webContents.getURL()).searchParams.get('type') === 'editor'
      } catch {
        return false
      }
    })
    .sort((a, b) => b.id - a.id)
  return windows[0] ?? null
}

const flushEditorBeforeBackup = async(): Promise<void> => {
  const target = editorWindow()
  if (!target) {
    await saveQueue
    return
  }

  const requestId = randomUUID()
  await new Promise<void>((resolve, reject) => {
    const onComplete = (event: IpcMainEvent, responseId: string, error?: string): void => {
      if (event.sender !== target.webContents || responseId !== requestId) return
      clearTimeout(timer)
      ipcMain.removeListener('mt::proplan::flush-before-backup-complete', onComplete)
      if (error) reject(new Error(error))
      else resolve()
    }
    const timer = setTimeout(() => {
      ipcMain.removeListener('mt::proplan::flush-before-backup-complete', onComplete)
      reject(
        new Error(
          localized(
            '备份前保存超时，请确认编辑窗口仍在运行',
            'Saving before backup timed out. Make sure the editor window is still running'
          )
        )
      )
    }, EDITOR_FLUSH_TIMEOUT)
    ipcMain.on('mt::proplan::flush-before-backup-complete', onComplete)
    target.webContents.send('mt::proplan::flush-before-backup', requestId)
  })
  await saveQueue
}

const defaultBackupName = (): string => {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
  return `Proplan-backup-${timestamp}.${BACKUP_EXTENSION}`
}

const backupProplan = async(event: Electron.IpcMainInvokeEvent): Promise<ProplanBackupResult> => {
  const owner = BrowserWindow.fromWebContents(event.sender)
  const options: Electron.SaveDialogOptions = {
    title: localized('备份 Proplan 数据', 'Back up Proplan data'),
    defaultPath: path.join(app.getPath('documents'), defaultBackupName()),
    filters: [{ name: 'Proplan Backup', extensions: [BACKUP_EXTENSION] }]
  }
  const result = owner
    ? await dialog.showSaveDialog(owner, options)
    : await dialog.showSaveDialog(options)
  if (result.canceled || !result.filePath) return { status: 'cancelled' }

  await flushEditorBeforeBackup()
  const backup = await createBackupDocument()
  const filePath = result.filePath.endsWith(`.${BACKUP_EXTENSION}`)
    ? result.filePath
    : `${result.filePath}.${BACKUP_EXTENSION}`
  await writeFileAtomic(filePath, encodeBackupDocument(backup))
  return {
    status: 'saved',
    filePath,
    createdAt: backup.createdAt,
    assetCount: backup.assets.length
  }
}

export const parseProplanBackup = (source: string): ProplanBackupDocument => {
  let value: unknown
  try {
    value = JSON.parse(source) as unknown
  } catch {
    throw new Error(localized('这不是有效的 Proplan 备份文件', 'This is not a valid Proplan backup'))
  }
  if (!isObject(value) || value.format !== BACKUP_FORMAT || value.version !== BACKUP_VERSION) {
    throw new Error(
      localized('备份格式不受支持或版本不兼容', 'The backup format is unsupported or incompatible')
    )
  }
  if (
    typeof value.createdAt !== 'string' ||
    typeof value.sourceAssetsPath !== 'string' ||
    value.sourceAssetsPath.length === 0 ||
    typeof value.sourceAssetsUrl !== 'string' ||
    value.sourceAssetsUrl.length === 0 ||
    !isObject(value.database) ||
    !isObject(value.preferences) ||
    !Array.isArray(value.assets)
  ) {
    throw new Error(localized('备份文件缺少必要数据', 'The backup is missing required data'))
  }
  let sourceAssetsUrl: URL
  try {
    sourceAssetsUrl = new URL(value.sourceAssetsUrl)
  } catch {
    throw new Error(localized('备份中的图片来源路径无效', 'The backup contains an invalid image source path'))
  }
  if (
    sourceAssetsUrl.protocol !== 'file:' ||
    !/(?:^|[\\/])proplan-assets[\\/]?$/.test(value.sourceAssetsPath) ||
    !/(?:^|\/)proplan-assets\/?$/.test(sourceAssetsUrl.pathname)
  ) {
    throw new Error(localized('备份中的图片来源路径无效', 'The backup contains an invalid image source path'))
  }

  const filenames = new Set<string>()
  const assets = value.assets.map((entry): ProplanBackupAsset => {
    if (
      !isObject(entry) ||
      typeof entry.filename !== 'string' ||
      path.basename(entry.filename) !== entry.filename ||
      /[\\/]/.test(entry.filename) ||
      typeof entry.data !== 'string' ||
      typeof entry.sha256 !== 'string'
    ) {
      throw new Error(localized('备份中的图片清单无效', 'The backup contains an invalid image manifest'))
    }
    if (filenames.has(entry.filename)) {
      throw new Error(
        localized(`备份中存在重复图片：${entry.filename}`, `Duplicate image in backup: ${entry.filename}`)
      )
    }
    filenames.add(entry.filename)
    const extension = path.extname(entry.filename).slice(1).toLowerCase()
    if (!IMAGE_EXTENSIONS.has(extension)) {
      throw new Error(
        localized(
          `备份包含不支持的图片：${entry.filename}`,
          `Backup contains an unsupported image: ${entry.filename}`
        )
      )
    }
    const data = Buffer.from(entry.data, 'base64')
    if (data.byteLength > MAX_IMAGE_BYTES || data.toString('base64') !== entry.data) {
      throw new Error(
        localized(`备份中的图片数据无效：${entry.filename}`, `Invalid image data in backup: ${entry.filename}`)
      )
    }
    assertImageBytes(data, extension)
    const digest = createHash('sha256').update(data).digest('hex')
    if (digest !== entry.sha256) {
      throw new Error(
        localized(`图片校验失败：${entry.filename}`, `Image checksum failed: ${entry.filename}`)
      )
    }
    return { filename: entry.filename, data: entry.data, sha256: entry.sha256 }
  })

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: value.createdAt,
    appVersion: stringValue(value.appVersion),
    sourceAssetsPath: value.sourceAssetsPath,
    sourceAssetsUrl: value.sourceAssetsUrl,
    database: normalizeProplanDatabase(value.database),
    preferences: sanitizeBackupPreferences(value.preferences),
    assets
  }
}

const rebaseBackupDatabase = (backup: ProplanBackupDocument): ProplanDatabase => {
  const database = normalizeProplanDatabase(backup.database)
  const assetsRoot = getAssetsPath()
  const assetsUrl = pathToFileURL(assetsRoot).href
  for (const record of allRecords(database)) {
    record.markdown = record.markdown
      .split(backup.sourceAssetsUrl)
      .join(assetsUrl)
      .split(backup.sourceAssetsPath)
      .join(assetsRoot)
  }
  return database
}

const applyBackupDocument = async(backup: ProplanBackupDocument): Promise<void> => {
  const userDataPath = app.getPath('userData')
  const dataPath = getDataPath()
  const assetsPath = getAssetsPath()
  const stageRoot = path.join(userDataPath, `.proplan-restore-${randomUUID()}`)
  const stageData = path.join(stageRoot, 'new', PROPLAN_DATABASE_FILENAME)
  const stageAssets = path.join(stageRoot, 'new', ASSETS_DIRNAME)
  const rollbackData = path.join(stageRoot, 'rollback', PROPLAN_DATABASE_FILENAME)
  const rollbackAssets = path.join(stageRoot, 'rollback', ASSETS_DIRNAME)
  const hadData = await fs.pathExists(dataPath)
  const hadAssets = await fs.pathExists(assetsPath)
  const previousPreferences = await readStoredPreferences()
  const database = rebaseBackupDatabase(backup)

  await fs.ensureDir(stageAssets)
  await fs.ensureDir(path.dirname(rollbackData))
  writeProplanDatabase(stageData, database)
  for (const asset of backup.assets) {
    await fs.writeFile(path.join(stageAssets, asset.filename), Buffer.from(asset.data, 'base64'), {
      flag: 'wx'
    })
  }

  if (cleanupTimer) {
    clearTimeout(cleanupTimer)
    cleanupTimer = null
  }
  pendingAssetFilenames.clear()

  try {
    if (hadData) await fs.move(dataPath, rollbackData)
    if (hadAssets) await fs.move(assetsPath, rollbackAssets)
    await fs.move(stageData, dataPath)
    await fs.move(stageAssets, assetsPath)
    ipcMain.emit('set-user-preference', backup.preferences)
  } catch (error) {
    await fs.remove(dataPath)
    await fs.remove(assetsPath)
    if (hadData && (await fs.pathExists(rollbackData))) await fs.move(rollbackData, dataPath)
    if (hadAssets && (await fs.pathExists(rollbackAssets))) { await fs.move(rollbackAssets, assetsPath) }
    ipcMain.emit('set-user-preference', previousPreferences)
    throw error
  } finally {
    await fs.remove(stageRoot)
  }

  const targets = BrowserWindow.getAllWindows().filter((window) => !window.isDestroyed())
  let editorNotified = false
  for (const window of targets) {
    try {
      if (new URL(window.webContents.getURL()).searchParams.get('type') === 'editor') {
        editorNotified = true
        window.webContents.send('mt::proplan::restored')
      }
    } catch {
      // Ignore windows that do not expose a valid URL yet.
    }
  }
  if (!editorNotified) scheduleAssetCleanup(database)
}

const restoreProplan = async(
  event: Electron.IpcMainInvokeEvent,
  request: ProplanRestoreRequest
): Promise<ProplanRestoreResult> => {
  const owner = BrowserWindow.fromWebContents(event.sender)
  const options: Electron.OpenDialogOptions = {
    title: request.confirmTitle,
    properties: ['openFile'],
    filters: [{ name: 'Proplan Backup', extensions: [BACKUP_EXTENSION] }]
  }
  const selected = owner
    ? await dialog.showOpenDialog(owner, options)
    : await dialog.showOpenDialog(options)
  const backupPath = selected.filePaths[0]
  if (selected.canceled || !backupPath) return { status: 'cancelled' }

  const stats = await fs.stat(backupPath)
  if (!stats.isFile() || stats.size > MAX_BACKUP_BYTES) {
    throw new Error(
      localized('备份文件无效或超过 1 GB', 'The backup is invalid or exceeds 1 GB')
    )
  }
  const backup = parseProplanBackup(await fs.readFile(backupPath, 'utf8'))
  const confirmationOptions: Electron.MessageBoxOptions = {
    type: 'warning',
    title: request.confirmTitle,
    message: request.confirmMessage,
    detail: request.confirmDetail,
    buttons: [request.confirmButton, request.cancelButton],
    defaultId: 1,
    cancelId: 1,
    noLink: true
  }
  const confirmation = owner
    ? await dialog.showMessageBox(owner, confirmationOptions)
    : await dialog.showMessageBox(confirmationOptions)
  if (confirmation.response !== 0) return { status: 'cancelled' }

  await flushEditorBeforeBackup()
  restoreInProgress = true
  try {
    const safetyBackup = await createBackupDocument()
    await writeFileAtomic(
      path.join(app.getPath('userData'), SAFETY_BACKUP_FILENAME),
      encodeBackupDocument(safetyBackup)
    )
    await applyBackupDocument(backup)
  } finally {
    restoreInProgress = false
  }
  return {
    status: 'restored',
    createdAt: backup.createdAt,
    assetCount: backup.assets.length
  }
}

export const registerProplanHandlers = (): void => {
  ipcMain.handle('mt::proplan::assets-path', async() => {
    const assetsPath = getAssetsPath()
    await fs.ensureDir(assetsPath)
    return assetsPath
  })
  ipcMain.handle('mt::proplan::open-assets-folder', async() => {
    const assetsPath = getAssetsPath()
    await fs.ensureDir(assetsPath)
    return shell.openPath(assetsPath)
  })
  ipcMain.handle('mt::proplan::backup', backupProplan)
  ipcMain.handle('mt::proplan::load', loadDatabase)
  ipcMain.handle('mt::proplan::import-image', importImage)
  ipcMain.handle('mt::proplan::restore', restoreProplan)
  ipcMain.handle('mt::proplan::save', (_event, database: ProplanDatabase) => saveDatabase(database))
}
