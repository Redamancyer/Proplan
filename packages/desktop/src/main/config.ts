import path from 'path'
import type { BrowserWindowConstructorOptions } from 'electron'

export const isOsx = process.platform === 'darwin'
export const isWindows = process.platform === 'win32'
export const isLinux = process.platform === 'linux'

export const shouldUseNativeTitleBar = (
  titleBarStyle: string | undefined,
  platform: NodeJS.Platform = process.platform
): boolean => platform === 'win32' || titleBarStyle === 'native'

const webPreferences: Electron.WebPreferences = {
  contextIsolation: true,
  sandbox: true,
  spellcheck: true,
  nodeIntegration: false,
  webSecurity: false,
  preload: path.join(__dirname, '../preload/index.js')
}

export const mainWindowOptions: Readonly<BrowserWindowConstructorOptions> = Object.freeze({
  minWidth: 760,
  minHeight: 520,
  width: 1200,
  height: 800,
  webPreferences,
  useContentSize: true,
  show: true,
  acceptFirstMouse: true,
  frame: false,
  titleBarStyle: 'hiddenInset'
})

export const TITLE_BAR_HEIGHT = isOsx ? 21 : 32
