// @vitest-environment node
import os from 'os'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const electronMock = vi.hoisted(() => ({
  userDataPath: '',
  ipcMain: { handle: vi.fn() },
  netFetch: vi.fn()
}))

vi.mock('electron', () => ({
  app: { getPath: () => electronMock.userDataPath },
  BrowserWindow: { fromWebContents: vi.fn() },
  dialog: { showOpenDialog: vi.fn() },
  ipcMain: electronMock.ipcMain,
  net: { fetch: electronMock.netFetch }
}))

import {
  cleanupUnreferencedAssets,
  downloadRemoteImage,
  flattenManagedAssets,
  importImage,
  normalizeProplanDatabase,
  parseProplanBackup,
  readDataImage,
  readLocalImage
} from 'main_renderer/ipc/proplan'
import type { ProplanDatabase } from '@shared/types/proplan'
import { PROPLAN_DATABASE_FILENAME, readProplanDatabase } from 'main_renderer/database/proplan'

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
)

describe('Proplan managed image assets', () => {
  beforeEach(async() => {
    electronMock.userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'proplan-assets-'))
    electronMock.netFetch.mockReset()
  })

  afterEach(async() => {
    await fs.remove(electronMock.userDataPath)
  })

  it('validates image content instead of trusting the extension or data URL', async() => {
    const imagePath = path.join(electronMock.userDataPath, 'valid.png')
    const fakePath = path.join(electronMock.userDataPath, 'fake.png')
    await fs.writeFile(imagePath, PNG)
    await fs.writeFile(fakePath, 'not an image')

    await expect(readLocalImage(imagePath)).resolves.toMatchObject({ extension: 'png' })
    await expect(readLocalImage(fakePath)).rejects.toThrow('文件内容不是受支持的图片格式')
    expect(readDataImage(`data:image/png;base64,${PNG.toString('base64')}`).extension).toBe('png')
    expect(() => readDataImage('data:text/plain;base64,SGVsbG8=')).toThrow('图片数据无效')
  })

  it('accepts successful Electron responses that omit the final response URL', async() => {
    electronMock.netFetch.mockResolvedValue(
      new Response(PNG, {
        status: 200,
        headers: { 'content-type': 'image/png' }
      })
    )

    await expect(
      downloadRemoteImage('https://example.com/image.png?token=a&size=large')
    ).resolves.toEqual({ data: PNG, extension: 'png' })
  })

  it('stores new images directly in the managed assets root', async() => {
    const result = await importImage({} as never, {
      kind: 'data',
      dataUrl: `data:image/png;base64,${PNG.toString('base64')}`
    })
    const assetsRoot = path.join(electronMock.userDataPath, 'proplan-assets')

    expect(result).not.toBeNull()
    if (!result) throw new Error('Expected a managed image result')
    expect(path.dirname(fileURLToPath(result.url))).toBe(assetsRoot)
    await expect(fs.pathExists(path.join(assetsRoot, result.filename))).resolves.toBe(true)
  })

  it('protects a newly imported image from cleanup until its first successful save', async() => {
    const result = await importImage({} as never, {
      kind: 'data',
      dataUrl: `data:image/png;base64,${PNG.toString('base64')}`
    })
    if (!result) throw new Error('Expected a managed image result')
    const imagePath = fileURLToPath(result.url)

    await cleanupUnreferencedAssets('')

    await expect(fs.pathExists(imagePath)).resolves.toBe(true)
  })

  it('keeps referenced files and removes only unreferenced managed assets', async() => {
    const assetsRoot = path.join(electronMock.userDataPath, 'proplan-assets')
    const legacyDir = path.join(assetsRoot, 'record-1')
    const kept = path.join(assetsRoot, 'kept.png')
    const orphan = path.join(assetsRoot, 'orphan.png')
    const legacyOrphan = path.join(legacyDir, 'legacy-orphan.png')
    const outside = path.join(electronMock.userDataPath, 'outside.png')
    await fs.ensureDir(legacyDir)
    await Promise.all([
      fs.writeFile(kept, PNG),
      fs.writeFile(orphan, PNG),
      fs.writeFile(legacyOrphan, PNG),
      fs.writeFile(outside, PNG)
    ])

    await cleanupUnreferencedAssets(`![图片](${pathToFileURL(kept).href})`)

    await expect(fs.pathExists(kept)).resolves.toBe(true)
    await expect(fs.pathExists(orphan)).resolves.toBe(false)
    await expect(fs.pathExists(legacyDir)).resolves.toBe(false)
    await expect(fs.pathExists(outside)).resolves.toBe(true)

    await cleanupUnreferencedAssets('')
    await expect(fs.pathExists(kept)).resolves.toBe(false)
  })

  it('flattens existing record directories and rewrites their Markdown URLs', async() => {
    const assetsRoot = path.join(electronMock.userDataPath, 'proplan-assets')
    const legacyDir = path.join(assetsRoot, 'record-1')
    const legacyImage = path.join(legacyDir, 'legacy.png')
    await fs.ensureDir(legacyDir)
    await fs.writeFile(legacyImage, PNG)

    const timestamp = new Date().toISOString()
    const database: ProplanDatabase = {
      version: 1,
      globalTaskOrder: [],
      projects: [
        {
          id: 'project-1',
          name: 'Project',
          description: '',
          color: '#4f7c6a',
          createdAt: timestamp,
          updatedAt: timestamp,
          memos: [
            {
              id: 'record-1',
              title: 'Memo',
              markdown: `![](${pathToFileURL(legacyImage).href})`,
              createdAt: timestamp,
              updatedAt: timestamp
            }
          ],
          tasks: [],
          timeline: []
        }
      ]
    }

    const migrated = await flattenManagedAssets(database)
    const flattenedImage = path.join(assetsRoot, 'legacy.png')

    await expect(fs.pathExists(flattenedImage)).resolves.toBe(true)
    await expect(fs.pathExists(legacyDir)).resolves.toBe(false)
    expect(migrated.projects[0].memos[0].markdown).toContain(pathToFileURL(flattenedImage).href)
    expect(
      readProplanDatabase(path.join(electronMock.userDataPath, PROPLAN_DATABASE_FILENAME))
        .projects[0].memos[0].markdown
    ).toContain(pathToFileURL(flattenedImage).href)
  })

  it('validates backup metadata, image hashes, and safe asset filenames', () => {
    const createdAt = new Date().toISOString()
    const sourceAssetsPath = path.join(electronMock.userDataPath, 'proplan-assets')
    const backup = {
      format: 'proplan-backup',
      version: 1,
      createdAt,
      appVersion: 'test',
      sourceAssetsPath,
      sourceAssetsUrl: pathToFileURL(sourceAssetsPath).href,
      database: { version: 1, projects: [] },
      preferences: {
        autoSave: true,
        __internal__: { migrations: { version: '0.20.0-dev' } }
      },
      assets: [
        {
          filename: 'image.png',
          data: PNG.toString('base64'),
          sha256: '431ced6916a2a21a156e38701afe55bbd7f88969fbbfc56d7fe099d47f265460'
        }
      ]
    }

    expect(parseProplanBackup(JSON.stringify(backup))).toMatchObject({
      createdAt,
      preferences: { autoSave: true },
      assets: [{ filename: 'image.png' }]
    })
    expect(parseProplanBackup(JSON.stringify(backup)).preferences).not.toHaveProperty(
      '__internal__'
    )

    backup.assets[0].sha256 = '0'.repeat(64)
    expect(() => parseProplanBackup(JSON.stringify(backup))).toThrow('图片校验失败')

    backup.assets[0].filename = '../image.png'
    expect(() => parseProplanBackup(JSON.stringify(backup))).toThrow('图片清单无效')
  })

  it('rejects incomplete or duplicate database identifiers', () => {
    const timestamp = new Date().toISOString()
    const record = {
      id: 'record-1',
      title: 'Memo',
      markdown: '',
      createdAt: timestamp,
      updatedAt: timestamp
    }
    const project = {
      id: 'project-1',
      name: 'Project',
      description: '',
      color: '#4f7c6a',
      createdAt: timestamp,
      updatedAt: timestamp,
      memos: [record],
      tasks: [],
      timeline: []
    }

    expect(() => normalizeProplanDatabase({ version: 1, projects: [{ ...project, id: '' }] })).toThrow(
      '缺少有效 ID'
    )
    expect(() =>
      normalizeProplanDatabase({ version: 1, projects: [{ ...project, tasks: [record] }] })
    ).toThrow('记录 ID 重复')
    expect(() => normalizeProplanDatabase({ version: 1, projects: [project, project] })).toThrow(
      '项目 ID 重复'
    )
    expect(() => normalizeProplanDatabase({ version: 1, projects: [{ ...project, memos: null }] })).toThrow(
      '列表无效'
    )
  })
})
