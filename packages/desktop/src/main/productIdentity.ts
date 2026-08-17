import path from 'path'
import { pathToFileURL } from 'url'
import fs from 'fs-extra'
import { app } from 'electron'

export const PRODUCT_NAME = 'Proplan'

const LEGACY_PRODUCT_NAME = 'marktext'
const MIGRATED_ENTRIES = [
  'dataCenter.json',
  'editorStates',
  'preferences.json',
  'proplan-assets',
  'proplan-data.json',
  'screenshot',
  'window-state.json'
]

const replaceInJsonFile = (filePath: string, from: string, to: string): void => {
  if (!fs.existsSync(filePath)) return
  const source = fs.readFileSync(filePath, 'utf8')
  const migrated = source.split(from).join(to)
  if (migrated !== source) fs.writeFileSync(filePath, migrated)
}

export const migrateLegacyUserData = (
  legacyUserDataPath: string,
  userDataPath: string
): void => {
  if (!fs.existsSync(legacyUserDataPath)) return

  fs.ensureDirSync(userDataPath)
  for (const entry of MIGRATED_ENTRIES) {
    const source = path.join(legacyUserDataPath, entry)
    const destination = path.join(userDataPath, entry)
    if (fs.existsSync(source) && !fs.existsSync(destination)) {
      fs.copySync(source, destination, { overwrite: false })
    }
  }

  replaceInJsonFile(
    path.join(userDataPath, 'proplan-data.json'),
    pathToFileURL(path.join(legacyUserDataPath, 'proplan-assets')).href,
    pathToFileURL(path.join(userDataPath, 'proplan-assets')).href
  )
  replaceInJsonFile(
    path.join(userDataPath, 'dataCenter.json'),
    legacyUserDataPath,
    userDataPath
  )
}

export const configureProductIdentity = (): void => {
  const appDataPath = app.getPath('appData')
  const legacyUserDataPath = path.join(appDataPath, LEGACY_PRODUCT_NAME)
  const userDataPath = path.join(appDataPath, PRODUCT_NAME)

  try {
    migrateLegacyUserData(legacyUserDataPath, userDataPath)
  } catch (error) {
    console.warn('Unable to migrate legacy Proplan data:', error)
  }

  app.setName(PRODUCT_NAME)
  app.setPath('userData', userDataPath)
}
