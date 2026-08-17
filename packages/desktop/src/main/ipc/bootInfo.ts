import path from 'path'
import fs from 'fs-extra'
import { app, ipcMain } from 'electron'
import type { BootInfo } from '@shared/types/ipc'

const buildBootInfo = (): BootInfo => ({
  platform: process.platform,
  arch: process.arch,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  },
  env: Object.fromEntries(
    ['NODE_ENV', 'MARKTEXT_VERSION', 'MARKTEXT_VERSION_STRING'].flatMap((key) =>
      process.env[key] === undefined ? [] : [[key, process.env[key] as string]]
    )
  ),
  paths: {
    resources: process.resourcesPath,
    userData: app.getPath('userData'),
    cwd: process.cwd()
  },
  isUpdatable:
    (process.platform === 'darwin' || process.platform === 'win32' || !!process.env.APPIMAGE) &&
    fs.pathExistsSync(path.join(process.resourcesPath, 'app-update.yml'))
})

let cached: BootInfo | null = null

export const registerBootInfo = (): void => {
  ipcMain.on('mt::boot-info', (event) => {
    cached ??= buildBootInfo()
    event.returnValue = cached
  })
}
