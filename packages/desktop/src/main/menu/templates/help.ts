import { shell, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import * as actions from '../actions/help'
import { checkUpdates } from '../actions/marktext'
import { t } from '../../i18n'

export default function(): MenuItemConstructorOptions {
  const submenu: MenuItemConstructorOptions[] = [
    {
      label: t('menu.help.markdownReference'),
      click() {
        shell.openExternal('https://marktext.me/docs/markdown-syntax')
      }
    },
    {
      label: t('menu.help.checkUpdates'),
      click(_menuItem, browserWindow) {
        checkUpdates(browserWindow as BrowserWindow | null)
      }
    },
    { type: 'separator' },
    {
      label: t('menu.help.license'),
      click(_menuItem, browserWindow) {
        actions.showAboutDialog(browserWindow as BrowserWindow | undefined, 'application')
      }
    }
  ]

  if (process.platform !== 'darwin') {
    submenu.push(
      { type: 'separator' },
      {
        label: t('menu.help.about'),
        click(_menuItem, browserWindow) {
          actions.showAboutDialog(browserWindow as BrowserWindow | undefined)
        }
      }
    )
  }

  return {
    label: t('menu.help.help'),
    role: 'help',
    submenu
  }
}
