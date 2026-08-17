import { describe, expect, it, vi } from 'vitest'
import { applyWindowZoom } from 'main_renderer/windows/zoom'

const createWebContents = (initialZoom: number) => ({
  getZoomFactor: vi.fn(() => initialZoom),
  setZoomFactor: vi.fn(),
  send: vi.fn()
})

describe('window menu zoom', () => {
  it('applies zoom immediately and notifies the renderer', () => {
    const webContents = createWebContents(1)

    expect(applyWindowZoom(webContents, 'in')).toBe(1.125)
    expect(webContents.setZoomFactor).toHaveBeenCalledWith(1.125)
    expect(webContents.send).toHaveBeenCalledWith('mt::window-zoom', 1.125)
  })

  it('keeps zoom within the supported range', () => {
    expect(applyWindowZoom(createWebContents(2), 'in')).toBe(2)
    expect(applyWindowZoom(createWebContents(0.5), 'out')).toBe(0.5)
  })
})
