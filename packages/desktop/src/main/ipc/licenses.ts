import path from 'node:path'
import fs from 'fs-extra'
import { app, ipcMain } from 'electron'
import type { LicenseDocumentKind } from '@shared/types/licenses'

const LICENSE_FILES: Record<LicenseDocumentKind, string> = {
  application: 'LICENSE.txt',
  thirdParty: 'THIRD-PARTY-LICENSES.txt'
}

const getLicenseRoot = (): string =>
  app.isPackaged
    ? path.join(process.resourcesPath, 'licenses')
    : path.join(app.getAppPath(), 'build')

export const readBundledLicense = async(kind: LicenseDocumentKind): Promise<string> => {
  const filename = LICENSE_FILES[kind]
  if (!filename) throw new Error('Unknown license document')
  return fs.readFile(path.join(getLicenseRoot(), filename), 'utf8')
}

export const registerLicenseHandlers = (): void => {
  ipcMain.handle('mt::licenses::read', (_event, kind: LicenseDocumentKind) =>
    readBundledLicense(kind)
  )
}
