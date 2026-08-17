import { BrowserWindow, ipcMain, type IpcMainEvent } from 'electron'

const windowFromEvent = (event: IpcMainEvent): BrowserWindow | null =>
  BrowserWindow.fromWebContents(event.sender)

export const registerWindowHandlers = (): void => {
  ipcMain.on('mt::win::minimize', (event) => windowFromEvent(event)?.minimize())
  ipcMain.on('mt::win::maximize', (event) => windowFromEvent(event)?.maximize())
  ipcMain.on('mt::win::unmaximize', (event) => windowFromEvent(event)?.unmaximize())
  ipcMain.on('mt::win::close', (event) => windowFromEvent(event)?.close())
  ipcMain.on('mt::win::toggle-maximize', (event) => {
    const window = windowFromEvent(event)
    if (!window) return
    if (window.isMaximized()) window.unmaximize()
    else window.maximize()
  })
  ipcMain.on('mt::win::set-fullscreen', (event, flag: boolean) => {
    windowFromEvent(event)?.setFullScreen(Boolean(flag))
  })
  ipcMain.on('mt::win::toggle-fullscreen', (event) => {
    const window = windowFromEvent(event)
    if (window) window.setFullScreen(!window.isFullScreen())
  })
  ipcMain.handle('mt::win::is-maximized', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    return window?.isMaximized() ?? false
  })
  ipcMain.handle('mt::win::is-fullscreen', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    return window?.isFullScreen() ?? false
  })
}
