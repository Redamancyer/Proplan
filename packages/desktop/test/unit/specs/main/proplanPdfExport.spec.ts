// @vitest-environment node
import os from 'os'
import path from 'path'
import fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const electronMock = vi.hoisted(() => {
  const state = {
    root: '',
    outputPath: '',
    dialogResult: { canceled: false, filePath: '' as string | undefined }
  }
  const webContents = {
    executeJavaScript: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    printToPDF: vi.fn().mockResolvedValue(Buffer.from('%PDF-test')),
    setWindowOpenHandler: vi.fn()
  }
  const window = {
    destroy: vi.fn(),
    isDestroyed: vi.fn(() => false),
    loadFile: vi.fn().mockResolvedValue(undefined),
    webContents
  }
  return {
    state,
    webContents,
    window,
    BrowserWindow: Object.assign(
      vi.fn(function BrowserWindowMock() {
        return window
      }),
      {
        fromWebContents: vi.fn(() => null),
        getAllWindows: vi.fn(() => [])
      }
    )
  }
})

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) =>
      name === 'documents'
        ? path.join(electronMock.state.root, 'documents')
        : electronMock.state.root
  },
  BrowserWindow: electronMock.BrowserWindow,
  dialog: {
    showSaveDialog: vi.fn(async() => electronMock.state.dialogResult),
    showOpenDialog: vi.fn()
  },
  ipcMain: { handle: vi.fn(), on: vi.fn(), removeListener: vi.fn() },
  net: { fetch: vi.fn() },
  shell: { openPath: vi.fn(), showItemInFolder: vi.fn() }
}))

import { exportProplanPdf, sanitizePdfFilename } from 'main_renderer/ipc/proplan'

describe('Proplan PDF export', () => {
  beforeEach(async() => {
    electronMock.state.root = await fs.mkdtemp(path.join(os.tmpdir(), 'proplan-pdf-test-'))
    electronMock.state.outputPath = path.join(electronMock.state.root, 'documents', 'record')
    electronMock.state.dialogResult = {
      canceled: false,
      filePath: electronMock.state.outputPath
    }
    await fs.ensureDir(path.dirname(electronMock.state.outputPath))
    vi.clearAllMocks()
  })

  afterEach(async() => {
    await fs.remove(electronMock.state.root)
  })

  it('sanitizes titles for the default PDF filename', () => {
    expect(sanitizePdfFilename('a/b:c*?')).toBe('a-b-c--')
  })

  it('prints a hidden isolated page and appends the PDF extension', async() => {
    const result = await exportProplanPdf({ sender: {} } as Electron.IpcMainInvokeEvent, {
      title: '导出记录',
      html: '<!doctype html><html><body>正文</body></html>'
    })
    const outputPath = `${electronMock.state.outputPath}.pdf`

    expect(result).toEqual({ status: 'saved', filePath: outputPath })
    await expect(fs.readFile(outputPath, 'utf8')).resolves.toBe('%PDF-test')
    expect(electronMock.BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        show: false,
        webPreferences: expect.objectContaining({ nodeIntegration: false, sandbox: true })
      })
    )
    expect(electronMock.webContents.printToPDF).toHaveBeenCalledWith({
      preferCSSPageSize: true,
      printBackground: true
    })
    const { shell } = await import('electron')
    expect(shell.showItemInFolder).toHaveBeenCalledWith(outputPath)
    expect(electronMock.window.destroy).toHaveBeenCalled()
  })

  it('does not create a print window when saving is cancelled', async() => {
    electronMock.state.dialogResult = { canceled: true, filePath: undefined }

    await expect(
      exportProplanPdf({ sender: {} } as Electron.IpcMainInvokeEvent, {
        title: '导出记录',
        html: '<!doctype html><html></html>'
      })
    ).resolves.toEqual({ status: 'cancelled' })
    expect(electronMock.BrowserWindow).not.toHaveBeenCalled()
  })
})
