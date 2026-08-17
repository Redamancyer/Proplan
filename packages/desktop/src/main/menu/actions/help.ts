import { type BrowserWindow } from 'electron'
import type { LicenseDocumentKind } from '@shared/types/licenses'

export const showAboutDialog = (
  win: BrowserWindow | null | undefined,
  license?: LicenseDocumentKind
): void => {
  if (win && win.webContents) {
    win.webContents.send('mt::about-dialog', license)
  }
}
