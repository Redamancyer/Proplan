import { _electron, type ElectronApplication, type Page } from 'playwright'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

const projectRoot = path.resolve(__dirname, '../..')
const createdTempDirs = new Set<string>()

export const getElectronPath = (): string => {
  if (process.platform === 'win32') {
    return path.resolve('node_modules', '.bin', 'electron.cmd')
  }
  const relativePath = fs
    .readFileSync(path.join(projectRoot, 'node_modules/electron/path.txt'), 'utf8')
    .trim()
  return path.join(projectRoot, 'node_modules/electron/dist', relativePath)
}

process.on('exit', () => {
  for (const directory of createdTempDirs) {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

export const launchElectron = async(userArgs: string[] = []): Promise<{
  app: ElectronApplication
  page: Page
}> => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'proplan-e2e-'))
  createdTempDirs.add(userDataDir)
  const env = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
  )
  env.PERF_TESTING = 'true'
  const app = await _electron.launch({
    executablePath: getElectronPath(),
    args: [projectRoot, '--user-data-dir', userDataDir, ...userArgs],
    cwd: projectRoot,
    env,
    timeout: 30_000
  })
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  return { app, page }
}
