import { app, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import { showAboutDialog } from '../actions/help'
import { checkUpdates, osxHide, osxHideAll, osxShowAll, userSetting } from '../actions/marktext'
import { t } from '../../i18n'
import type Keybindings from '../../keyboard/shortcutHandler'

// macOS only menu.

export default function(keybindings: Keybindings): MenuItemConstructorOptions {
  return {
    label: t('menu.marktext.title'),
    submenu: [
      {
        label: t('menu.marktext.about'),
        click(_menuItem, focusedWindow) {
          showAboutDialog(focusedWindow as BrowserWindow | undefined)
        }
      },
      {
        label: t('menu.marktext.checkUpdates'),
        click(_menuItem, focusedWindow) {
          checkUpdates(focusedWindow as BrowserWindow | null)
        }
      },
      {
        label: t('menu.marktext.preferences'),
        accelerator: keybindings.getAccelerator('file.preferences') ?? undefined,
        click() {
          userSetting()
        }
      },
      {
        type: 'separator'
      },
      {
        label: t('menu.marktext.services'),
        role: 'services',
        submenu: []
      },
      {
        type: 'separator'
      },
      {
        label: t('menu.marktext.hide'),
        accelerator: keybindings.getAccelerator('mt.hide') ?? undefined,
        click() {
          osxHide()
        }
      },
      {
        label: t('menu.marktext.hideOthers'),
        accelerator: keybindings.getAccelerator('mt.hide-others') ?? undefined,
        click() {
          osxHideAll()
        }
      },
      {
        label: t('menu.marktext.showAll'),
        click() {
          osxShowAll()
        }
      },
      {
        type: 'separator'
      },
      {
        label: t('menu.marktext.quit'),
        accelerator: keybindings.getAccelerator('file.quit') ?? undefined,
        click: app.quit
      }
    ]
  }
}
