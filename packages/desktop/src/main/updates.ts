import { autoUpdater } from 'electron-updater'
import { BrowserWindow, ipcMain } from 'electron'

let running = false
let downloaded = false
let target: BrowserWindow | null = null

autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = false

const send = (channel: string, message: string): void => {
  if (target && !target.isDestroyed()) target.webContents.send(channel, message)
}

autoUpdater.on('error', (error: Error) => {
  send('mt::UPDATE_ERROR', `检查或下载更新失败：${error.message}`)
  running = false
})
autoUpdater.on('update-available', (info) => {
  send('mt::UPDATE_AVAILABLE', `发现新版本 v${info.version}，是否立即下载？`)
})
autoUpdater.on('update-not-available', () => {
  send('mt::UPDATE_NOT_AVAILABLE', '当前已是最新版本。')
  running = false
})
autoUpdater.on('update-downloaded', () => {
  downloaded = true
  running = false
  send('mt::UPDATE_DOWNLOADED', '更新已下载完成。是否立即重启并安装？')
})

ipcMain.on('mt::NEED_UPDATE', (_event, payload: { needUpdate?: boolean }) => {
  if (payload?.needUpdate) {
    send('mt::UPDATE_DOWNLOADING', '正在后台下载更新…')
    autoUpdater.downloadUpdate().catch(() => undefined)
  } else {
    running = false
  }
})
ipcMain.on('mt::INSTALL_UPDATE', () => {
  if (downloaded) autoUpdater.quitAndInstall(false, true)
})

export const checkUpdates = (window: BrowserWindow | null): void => {
  if (running) {
    send('mt::UPDATE_CHECKING', '正在检查或下载更新，请稍候…')
    return
  }
  running = true
  downloaded = false
  target = window ?? BrowserWindow.getFocusedWindow() ?? null
  send('mt::UPDATE_CHECKING', '正在检查更新…')
  autoUpdater.checkForUpdates().catch(() => undefined)
}
