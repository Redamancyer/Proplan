import { app, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import * as actions from '../actions/file'
import { userSetting } from '../actions/marktext'
import { isOsx } from '../../config'
import { t } from '../../i18n'
import type Keybindings from '../../keyboard/shortcutHandler'
import type Preference from '../../preferences'

export default function(
  keybindings: Keybindings,
  userPreference: Preference,
  _recentlyUsedFiles: string[]
): MenuItemConstructorOptions {
  const { autoSave } = userPreference.getAll() as { autoSave?: boolean }
  const submenu: MenuItemConstructorOptions[] = []

  if (!isOsx) {
    submenu.push(
      {
        label: t('menu.file.preferences'),
        accelerator: keybindings.getAccelerator('file.preferences') ?? undefined,
        click() {
          userSetting()
        }
      },
      { type: 'separator' }
    )
  }

  submenu.push(
    {
      label: t('menu.file.autoSave'),
      type: 'checkbox',
      checked: !!autoSave,
      id: 'autoSaveMenuItem',
      click(menuItem, browserWindow) {
        actions.autoSave(menuItem, browserWindow as BrowserWindow | undefined)
      }
    },
    { type: 'separator' },
    {
      label: t('menu.file.closeWindow'),
      accelerator: keybindings.getAccelerator('file.close-window') ?? undefined,
      click(_menuItem, browserWindow) {
        actions.closeWindow(browserWindow as BrowserWindow | undefined)
      }
    }
  )

  if (!isOsx) {
    submenu.push(
      { type: 'separator' },
      {
        label: t('menu.file.quit'),
        accelerator: keybindings.getAccelerator('file.quit') ?? undefined,
        click: app.quit
      }
    )
  }

  return {
    label: t('menu.file.file'),
    submenu
  }
}
