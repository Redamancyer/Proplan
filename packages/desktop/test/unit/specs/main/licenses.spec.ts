// @vitest-environment node
import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const electronMock = vi.hoisted(() => ({
  appPath: '',
  handle: vi.fn()
}))

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => electronMock.appPath
  },
  ipcMain: {
    handle: electronMock.handle
  }
}))

import { readBundledLicense, registerLicenseHandlers } from 'main_renderer/ipc/licenses'

describe('bundled license documents', () => {
  let root: string

  beforeEach(async() => {
    electronMock.handle.mockReset()
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'proplan-licenses-'))
    electronMock.appPath = root
    await fs.ensureDir(path.join(root, 'build'))
    await fs.writeFile(path.join(root, 'build', 'LICENSE.txt'), 'MIT License\n')
    await fs.writeFile(
      path.join(root, 'build', 'THIRD-PARTY-LICENSES.txt'),
      'THIRD-PARTY SOFTWARE NOTICES\n'
    )
  })

  afterEach(async() => {
    await fs.remove(root)
  })

  it('reads only the two fixed license resources', async() => {
    await expect(readBundledLicense('application')).resolves.toBe('MIT License\n')
    await expect(readBundledLicense('thirdParty')).resolves.toContain('THIRD-PARTY')
    await expect(readBundledLicense('../preferences.json' as never)).rejects.toThrow(
      'Unknown license document'
    )
  })

  it('registers the typed IPC reader', () => {
    registerLicenseHandlers()
    expect(electronMock.handle).toHaveBeenCalledWith('mt::licenses::read', expect.any(Function))
  })
})
