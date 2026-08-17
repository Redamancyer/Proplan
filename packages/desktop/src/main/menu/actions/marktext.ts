import { autoUpdater } from 'electron-updater'
import { BrowserWindow, Menu, ipcMain } from 'electron'
import { COMMANDS } from '../../commands'
import type { CommandManager } from '../../commands'
import { isOsx } from '../../config'

let runningUpdate = false
let updateDownloaded = false
let win: BrowserWindow | null = null

autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = false

const sendToUpdateWindow = (channel: string, message: string): void => {
  if (win && !win.isDestroyed()) win.webContents.send(channel, message)
}

autoUpdater.on('error', (error: Error) => {
  const detail = error?.message || String(error || '未知错误')
  sendToUpdateWindow('mt::UPDATE_ERROR', `检查或下载更新失败：${detail}`)
  runningUpdate = false
})

autoUpdater.on('update-available', (info) => {
  sendToUpdateWindow('mt::UPDATE_AVAILABLE', `发现新版本 v${info.version}，是否立即下载？`)
})

autoUpdater.on('update-not-available', (_info) => {
  sendToUpdateWindow('mt::UPDATE_NOT_AVAILABLE', '当前已是最新版本。')
  runningUpdate = false
})

autoUpdater.on('update-downloaded', (_event) => {
  updateDownloaded = true
  runningUpdate = false
  sendToUpdateWindow(
    'mt::UPDATE_DOWNLOADED',
    '更新已下载完成。是否立即重启并安装？请先保存正在编辑的内容。'
  )
})

ipcMain.on('mt::NEED_UPDATE', (_e, payload: unknown) => {
  const needUpdate = !!(payload as { needUpdate?: boolean } | undefined)?.needUpdate
  if (needUpdate) {
    sendToUpdateWindow('mt::UPDATE_DOWNLOADING', '正在后台下载更新…')
    autoUpdater.downloadUpdate().catch(() => undefined)
  } else {
    runningUpdate = false
  }
})

ipcMain.on('mt::INSTALL_UPDATE', () => {
  if (updateDownloaded) autoUpdater.quitAndInstall(false, true)
})

ipcMain.on('mt::check-for-update', (e) => {
  const senderWin = BrowserWindow.fromWebContents(e.sender)
  checkUpdates(senderWin)
})

// --------------------------------------------------------

export const userSetting = (): void => {
  ipcMain.emit('app-create-settings-window')
}

export const checkUpdates = (browserWindow: BrowserWindow | null): void => {
  if (!runningUpdate) {
    runningUpdate = true
    updateDownloaded = false
    win =
      browserWindow ?? BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null
    sendToUpdateWindow('mt::UPDATE_CHECKING', '正在检查更新…')
    autoUpdater.checkForUpdates().catch(() => undefined)
  } else {
    sendToUpdateWindow('mt::UPDATE_CHECKING', '正在检查或下载更新，请稍候…')
  }
}

export const osxHide = (): void => {
  if (isOsx) {
    Menu.sendActionToFirstResponder('hide:')
  }
}

export const osxHideAll = (): void => {
  if (isOsx) {
    Menu.sendActionToFirstResponder('hideOtherApplications:')
  }
}

export const osxShowAll = (): void => {
  if (isOsx) {
    Menu.sendActionToFirstResponder('unhideAllApplications:')
  }
}

// --- Commands -------------------------------------------------------------

export const loadMarktextCommands = (commandManager: CommandManager): void => {
  commandManager.add(COMMANDS.MT_HIDE, osxHide)
  commandManager.add(COMMANDS.MT_HIDE_OTHERS, osxHideAll)
}
