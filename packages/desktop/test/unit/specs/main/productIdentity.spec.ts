// @vitest-environment node
import os from 'os'
import path from 'path'
import { pathToFileURL } from 'url'
import fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(),
    setName: vi.fn(),
    setPath: vi.fn()
  }
}))

import { migrateLegacyUserData } from 'main_renderer/productIdentity'

describe('Proplan product identity migration', () => {
  let root: string
  let legacyPath: string
  let proplanPath: string

  beforeEach(async() => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'proplan-identity-'))
    legacyPath = path.join(root, 'marktext')
    proplanPath = path.join(root, 'Proplan')
    await fs.ensureDir(path.join(legacyPath, 'proplan-assets', 'record-1'))
  })

  afterEach(async() => {
    await fs.remove(root)
  })

  it('copies app data without overwriting new data and rewrites managed paths', async() => {
    const legacyAsset = path.join(legacyPath, 'proplan-assets', 'record-1', 'image.png')
    const newAsset = path.join(proplanPath, 'proplan-assets', 'record-1', 'image.png')
    await fs.writeFile(legacyAsset, 'image')
    await fs.writeJson(path.join(legacyPath, 'proplan-data.json'), {
      markdown: `![](${pathToFileURL(legacyAsset).href})`
    })
    await fs.writeJson(path.join(legacyPath, 'dataCenter.json'), {
      screenshotFolderPath: path.join(legacyPath, 'screenshot')
    })
    await fs.ensureDir(proplanPath)
    await fs.writeFile(path.join(proplanPath, 'preferences.json'), 'new preferences')
    await fs.writeFile(path.join(legacyPath, 'preferences.json'), 'legacy preferences')

    migrateLegacyUserData(legacyPath, proplanPath)

    await expect(fs.readFile(newAsset, 'utf8')).resolves.toBe('image')
    await expect(fs.readFile(path.join(proplanPath, 'preferences.json'), 'utf8'))
      .resolves.toBe('new preferences')
    await expect(fs.readFile(path.join(proplanPath, 'proplan-data.json'), 'utf8'))
      .resolves.toContain(pathToFileURL(newAsset).href)
    await expect(fs.readFile(path.join(proplanPath, 'dataCenter.json'), 'utf8'))
      .resolves.toContain(path.join(proplanPath, 'screenshot'))
  })
})
