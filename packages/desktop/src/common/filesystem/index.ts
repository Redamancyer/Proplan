import { lstatSync } from 'fs'
import { ensureDirSync as ensureDirectory } from 'fs-extra'

export const ensureDirSync = (directory: string): void => {
  ensureDirectory(directory)
}

export const isDirectory = (directory: string): boolean => {
  try {
    return lstatSync(directory).isDirectory()
  } catch {
    return false
  }
}
