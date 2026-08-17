import { type MenuItemConstructorOptions } from 'electron'
import { COMMANDS } from '../../commands'
import { t } from '../../i18n'
import type Keybindings from '../../keyboard/shortcutHandler'

export default function(keybindings: Keybindings): MenuItemConstructorOptions {
  return {
    label: t('menu.edit.edit'),
    submenu: [
      {
        label: t('menu.edit.undo'),
        accelerator: keybindings.getAccelerator(COMMANDS.EDIT_UNDO) ?? undefined,
        role: 'undo'
      },
      {
        label: t('menu.edit.redo'),
        accelerator: keybindings.getAccelerator(COMMANDS.EDIT_REDO) ?? undefined,
        role: 'redo'
      },
      { type: 'separator' },
      {
        label: t('menu.edit.cut'),
        accelerator: keybindings.getAccelerator(COMMANDS.EDIT_CUT) ?? undefined,
        role: 'cut'
      },
      {
        label: t('menu.edit.copy'),
        accelerator: keybindings.getAccelerator(COMMANDS.EDIT_COPY) ?? undefined,
        role: 'copy'
      },
      {
        label: t('menu.edit.paste'),
        accelerator: keybindings.getAccelerator(COMMANDS.EDIT_PASTE) ?? undefined,
        role: 'paste'
      },
      { type: 'separator' },
      {
        label: t('menu.edit.selectAll'),
        accelerator: keybindings.getAccelerator(COMMANDS.EDIT_SELECT_ALL) ?? undefined,
        role: 'selectAll'
      }
    ]
  }
}
