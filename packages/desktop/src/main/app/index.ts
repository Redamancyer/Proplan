import path from 'path'
import {
  app,
  BrowserWindow,
  Menu,
  nativeImage,
  nativeTheme,
  ipcMain,
  type MenuItemConstructorOptions
} from 'electron'
import log from 'electron-log'
import windowStateKeeper from 'electron-window-state'
import type { IUserPreferences } from '@shared/types/preferences'
import { getThemeBackgroundColor } from '../../common/theme'
import {
  isOsx,
  mainWindowOptions,
  preferencesWindowOptions,
  shouldUseNativeTitleBar,
  TITLE_BAR_HEIGHT
} from '../config'
import registerSpellcheckerListeners from '../spellchecker'
import { onInternalChannel } from '../utils/internalIpc'
import { setLanguage } from '../i18n'
import { checkUpdates } from '../updates'
import { getNativeThemeSource } from './nativeTheme'
import type Accessor from './accessor'

const ZOOM_FACTOR_STEP = 0.1
const MIN_ZOOM_FACTOR = 0.5
const MAX_ZOOM_FACTOR = 2

const setContentsZoom = (contents: Electron.WebContents, delta?: number): void => {
  const nextFactor = delta === undefined ? 1 : contents.getZoomFactor() + delta
  const clampedFactor = Math.max(MIN_ZOOM_FACTOR, Math.min(MAX_ZOOM_FACTOR, nextFactor))
  contents.setZoomFactor(Number(clampedFactor.toFixed(2)))
}

class App {
  private mainWindow: BrowserWindow | null = null
  private settingsWindow: BrowserWindow | null = null
  private allowMainClose = false
  private themeListenerRegistered = false
  private readonly applicationIcon = nativeImage.createFromPath(
    app.isPackaged && isOsx
      ? path.join(process.resourcesPath, 'icon.icns')
      : path.join(app.isPackaged ? process.resourcesPath : app.getAppPath(), 'static', 'icon.png')
  )

  constructor(
    private readonly accessor: Accessor,
    _args: { _: string[] }
  ) {
    setLanguage(this.accessor.preferences.getItem<string>('language') || 'en')
    this.listenForIpc()
  }

  init(): void {
    if (isOsx) app.commandLine.appendSwitch('enable-experimental-web-platform-features', 'true')
    app.on('second-instance', () => this.focusMainWindow())
    app.on('before-quit', () => {
      this.allowMainClose = true
    })
    app.on('open-file', (event) => {
      event.preventDefault()
      this.focusMainWindow()
    })
    app.on('ready', () => this.ready())
    app.on('activate', () => this.focusMainWindow())
    app.on('web-contents-created', (_event, contents) => {
      contents.on('will-attach-webview', (event) => event.preventDefault())
      contents.on('will-navigate', (event) => event.preventDefault())
      contents.setWindowOpenHandler(() => ({ action: 'deny' }))
      contents.on('did-finish-load', () => {
        contents.setZoomFactor(this.savedZoomFactor())
      })
      contents.on('before-input-event', (event, input) => {
        const commandPressed = isOsx ? input.meta : input.control
        if (!commandPressed || input.alt) return

        const zoomOut = input.code === 'Minus' || input.code === 'NumpadSubtract' || input.key === '-'
        const zoomIn =
          input.code === 'Equal' || input.code === 'NumpadAdd' || input.key === '+' || input.key === '='
        const resetZoom = input.code === 'Digit0' || input.code === 'Numpad0' || input.key === '0'
        if (!zoomOut && !zoomIn && !resetZoom) return

        event.preventDefault()
        if (resetZoom) {
          this.updateZoom(contents)
          return
        }
        this.updateZoom(contents, zoomIn ? ZOOM_FACTOR_STEP : -ZOOM_FACTOR_STEP)
      })
    })
  }

  private savedZoomFactor(): number {
    const value = this.accessor.preferences.getItem<number>('zoomFactor')
    return Number(
      Math.max(MIN_ZOOM_FACTOR, Math.min(MAX_ZOOM_FACTOR, Number(value) || 1)).toFixed(2)
    )
  }

  private applyZoomFactor(factor: number): void {
    const normalized = Number(
      Math.max(MIN_ZOOM_FACTOR, Math.min(MAX_ZOOM_FACTOR, factor)).toFixed(2)
    )
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.setZoomFactor(normalized)
    }
  }

  private updateZoom(contents: Electron.WebContents, delta?: number): void {
    setContentsZoom(contents, delta)
    const factor = contents.getZoomFactor()
    this.applyZoomFactor(factor)
    this.accessor.preferences.setItem('zoomFactor', factor)
  }

  private ready(): void {
    if (isOsx && app.dock && !this.applicationIcon.isEmpty()) app.dock.setIcon(this.applicationIcon)
    nativeTheme.themeSource = getNativeThemeSource(this.accessor.preferences.getAll())
    this.installApplicationMenu()
    this.registerThemeListeners()
    this.createMainWindow()
  }

  private rendererUrl(type: 'editor' | 'settings'): string {
    const baseUrl =
      process.env.NODE_ENV === 'development'
        ? process.env.ELECTRON_RENDERER_URL!
        : `file://${path.join(__dirname, '../renderer/index.html')}`
    const url = new URL(baseUrl)
    url.searchParams.set('type', type)
    url.searchParams.set('debug', this.accessor.env.debug ? '1' : '0')
    return url.toString()
  }

  private windowOptions(
    base: Readonly<Electron.BrowserWindowConstructorOptions>
  ): Electron.BrowserWindowConstructorOptions {
    const options: Electron.BrowserWindowConstructorOptions = {
      ...base,
      icon: this.applicationIcon.isEmpty() ? undefined : this.applicationIcon,
      backgroundColor: getThemeBackgroundColor(this.accessor.preferences.getItem('theme'))
    }
    if (!isOsx && shouldUseNativeTitleBar(this.accessor.preferences.getItem('titleBarStyle'))) {
      options.frame = true
      options.titleBarStyle = 'default'
    }
    return options
  }

  private createMainWindow(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.focusMainWindow()
      return
    }
    const state = windowStateKeeper({ defaultWidth: 1200, defaultHeight: 800 })
    const window = new BrowserWindow({
      ...this.windowOptions(mainWindowOptions),
      x: state.x,
      y: state.y,
      width: state.width,
      height: state.height
    })
    this.mainWindow = window
    this.allowMainClose = false
    state.manage(window)
    window.setSheetOffset(TITLE_BAR_HEIGHT)
    window.on('close', (event) => {
      if (this.allowMainClose) return
      event.preventDefault()
      window.webContents.send('mt::ask-for-close')
    })
    window.on('closed', () => {
      this.mainWindow = null
      this.allowMainClose = false
    })
    window.webContents.on('render-process-gone', (_event, details) => {
      log.error(`Main renderer exited: ${details.reason} (${details.exitCode})`)
    })
    window.loadURL(this.rendererUrl('editor'))
  }

  private openSettings(category?: string): void {
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.webContents.send('settings::change-tab', category)
      this.settingsWindow.show()
      this.settingsWindow.focus()
      return
    }
    const window = new BrowserWindow(this.windowOptions(preferencesWindowOptions))
    this.settingsWindow = window
    window.setSheetOffset(TITLE_BAR_HEIGHT)
    window.on('closed', () => {
      this.settingsWindow = null
    })
    window.loadURL(this.rendererUrl('settings'))
  }

  private focusMainWindow(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      if (app.isReady()) this.createMainWindow()
      return
    }
    if (this.mainWindow.isMinimized()) this.mainWindow.restore()
    this.mainWindow.show()
    this.mainWindow.focus()
  }

  private registerThemeListeners(): void {
    if (this.themeListenerRegistered) return
    onInternalChannel('broadcast-preferences-changed', (change: Partial<IUserPreferences>) => {
      const preferences = this.accessor.preferences
      nativeTheme.themeSource = getNativeThemeSource({ ...preferences.getAll(), ...change })
      if (change.language) setLanguage(change.language)
      if (typeof change.zoomFactor === 'number') this.applyZoomFactor(change.zoomFactor)
      this.applySystemTheme()
    })
    nativeTheme.on('updated', () => this.applySystemTheme())
    this.themeListenerRegistered = true
  }

  private applySystemTheme(): void {
    const preferences = this.accessor.preferences
    if (!preferences.getItem<boolean>('followSystemTheme')) return
    const theme = nativeTheme.shouldUseDarkColors
      ? preferences.getItem<string>('darkModeTheme')
      : preferences.getItem<string>('lightModeTheme')
    if (theme && theme !== preferences.getItem('theme')) preferences.setItem('theme', theme)
  }

  private listenForIpc(): void {
    registerSpellcheckerListeners()
    ipcMain.on('mt::get-current-language', (event) => {
      event.reply('mt::current-language', this.accessor.preferences.getItem('language') || 'en')
    })
    ipcMain.on('mt::open-setting-window', (_event, category?: string) => this.openSettings(category))
    onInternalChannel('app-create-settings-window', (category?: string) => this.openSettings(category))
    ipcMain.on('mt::close-window', (event) => {
      const window = BrowserWindow.fromWebContents(event.sender)
      if (!window) return
      if (window === this.mainWindow) this.allowMainClose = true
      window.close()
    })
    ipcMain.on('mt::check-for-update', (event) => {
      checkUpdates(BrowserWindow.fromWebContents(event.sender))
    })
  }

  private installApplicationMenu(): void {
    const showAbout = (): void => this.mainWindow?.webContents.send('mt::about-dialog')
    const setZoom = (window: Electron.BaseWindow | undefined, delta?: number): void => {
      const contents =
        window instanceof BrowserWindow ? window.webContents : this.mainWindow?.webContents
      if (!contents) return
      this.updateZoom(contents, delta)
    }
    const sendEditorCommand = (
      window: Electron.BaseWindow | undefined,
      command: 'undo' | 'redo'
    ): void => {
      const contents =
        window instanceof BrowserWindow ? window.webContents : this.mainWindow?.webContents
      if (!contents) return
      if (contents === this.settingsWindow?.webContents) {
        if (command === 'undo') contents.undo()
        else contents.redo()
        return
      }
      contents.send('mt::proplan::editor-command', command)
    }
    const template: MenuItemConstructorOptions[] = []
    if (isOsx) {
      template.push({
        label: app.name,
        submenu: [
          { label: `关于 ${app.name}`, click: showAbout },
          { type: 'separator' },
          { label: '偏好设置…', accelerator: 'CmdOrCtrl+,', click: () => this.openSettings() },
          { label: '检查更新…', click: () => checkUpdates(this.mainWindow) },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      })
    }
    template.push(
      {
        label: '编辑',
        submenu: [
          {
            label: '撤销',
            accelerator: 'CmdOrCtrl+Z',
            click: (_item, window) => sendEditorCommand(window, 'undo')
          },
          {
            label: '重做',
            accelerator: isOsx ? 'Shift+CmdOrCtrl+Z' : 'CmdOrCtrl+Y',
            click: (_item, window) => sendEditorCommand(window, 'redo')
          },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' }
        ]
      },
      {
        label: '显示',
        submenu: [
          { role: 'reload' },
          { role: 'toggleDevTools', visible: !app.isPackaged },
          { type: 'separator' },
          {
            label: '实际大小',
            accelerator: 'CmdOrCtrl+0',
            registerAccelerator: false,
            click: (_item, window) => setZoom(window)
          },
          {
            label: '放大',
            accelerator: 'CmdOrCtrl+Plus',
            registerAccelerator: false,
            click: (_item, window) => setZoom(window, ZOOM_FACTOR_STEP)
          },
          {
            label: '缩小',
            accelerator: 'CmdOrCtrl+-',
            registerAccelerator: false,
            click: (_item, window) => setZoom(window, -ZOOM_FACTOR_STEP)
          },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      { label: '窗口', role: 'windowMenu' }
    )
    if (!isOsx) {
      template.unshift({
        label: '文件',
        submenu: [
          { label: '设置', accelerator: 'CmdOrCtrl+,', click: () => this.openSettings() },
          { type: 'separator' },
          { role: 'quit' }
        ]
      })
      template.push({
        label: '帮助',
        submenu: [
          { label: '检查更新…', click: () => checkUpdates(this.mainWindow) },
          { label: `关于 ${app.name}`, click: showAbout }
        ]
      })
    }
    Menu.setApplicationMenu(Menu.buildFromTemplate(template))
  }
}

export default App
