import type { BrowserWindow } from 'electron'
import { electronLocalshortcut } from '@hfelix/electron-localshortcut'
import { isLinux, isOsx } from '../config'
import { getKeyboardInfo, keyboardLayoutMonitor, type KeyboardInfo } from '../keyboard'
import keybindingsDarwin from './keybindingsDarwin'
import keybindingsLinux from './keybindingsLinux'
import keybindingsWindows from './keybindingsWindows'
import type { CommandManager } from '../commands'
import type { AppEnvironment } from '../app/env'

type ShortcutCallback = (win: BrowserWindow) => void

const BASIC_KEYBINDING_IDS = new Set([
  'file.new-window',
  'file.new-tab',
  'file.open-file',
  'file.open-folder',
  'file.save',
  'file.save-as',
  'file.print',
  'file.preferences',
  'file.close-tab',
  'file.close-window',
  'file.quit',
  'edit.undo',
  'edit.redo',
  'edit.cut',
  'edit.copy',
  'edit.paste',
  'edit.paste-as-plaintext',
  'edit.select-all',
  'edit.find',
  'edit.find-next',
  'edit.find-previous',
  'edit.replace',
  'format.strong',
  'format.emphasis',
  'format.underline',
  'window.toggle-full-screen'
])

class Keybindings {
  commandManager: CommandManager
  keys: Map<string, string>

  /**
   * @param commandManager The command manager instance.
   * @param appEnvironment The application environment instance.
   */
  constructor(commandManager: CommandManager, appEnvironment: AppEnvironment) {
    this.commandManager = commandManager
    this.keys = this.getDefaultKeybindings()
    this._prepareKeyMapper()

    if (appEnvironment.isDevMode) {
      for (const [id, accelerator] of this.keys) {
        if (!commandManager.has(id)) {
          console.error(
            `[DEBUG] Command with id="${id}" isn't available for accelerator="${accelerator}".`
          )
        }
      }
    }
  }

  getAccelerator(id: string): string | null {
    const name = this.keys.get(id)
    if (!name) {
      return null
    }
    return name
  }

  registerAccelerator(win: BrowserWindow, accelerator: string, callback: ShortcutCallback): void {
    if (!win || !accelerator || !callback) {
      throw new Error(`addKeyHandler: invalid arguments (accelerator="${accelerator}").`)
    }

    // Register shortcuts on the BrowserWindow instead of using Chromium's native menu.
    // This makes it possible to receive key down events before Chromium/Electron and we
    // can handle reserved Chromium shortcuts. Afterwards prevent the default action of
    // the event so the native menu is not triggered.
    electronLocalshortcut.register(win, accelerator, () => {
      callback(win)
      return true // prevent default action
    })
  }

  registerEditorKeyHandlers(win: BrowserWindow): void {
    for (const [id, accelerator] of this.keys) {
      if (accelerator && accelerator.length > 1) {
        this.registerAccelerator(win, accelerator, () => {
          this.commandManager.execute(id, win)
        })
      }
    }
  }

  getDefaultKeybindings(): Map<string, string> {
    let platformKeybindings: Map<string, string>
    if (isOsx) {
      platformKeybindings = keybindingsDarwin
    } else if (isLinux) {
      platformKeybindings = keybindingsLinux
    } else {
      platformKeybindings = keybindingsWindows
    }
    return new Map(
      [...platformKeybindings].filter(([id, accelerator]) =>
        BASIC_KEYBINDING_IDS.has(id) && accelerator.length > 0
      )
    )
  }

  // --- private --------------------------------

  _prepareKeyMapper(): void {
    // Update the key mapper to prevent problems on non-US keyboards.
    const { layout, keymap } = getKeyboardInfo()
    electronLocalshortcut.setKeyboardLayout(layout, keymap)

    // Notify key mapper when the keyboard layout was changed.
    keyboardLayoutMonitor.addListener(({ layout, keymap }: KeyboardInfo) => {
      const globalDebug = (globalThis as typeof globalThis & { MARKTEXT_DEBUG?: boolean })
        .MARKTEXT_DEBUG
      if (globalDebug && process.env.MARKTEXT_DEBUG_KEYBOARD) {
        console.log('[DEBUG] Keyboard layout changed:\n', layout)
      }
      electronLocalshortcut.setKeyboardLayout(layout, keymap)
    })
  }
}

export default Keybindings
