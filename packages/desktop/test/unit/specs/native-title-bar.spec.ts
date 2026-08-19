import { describe, expect, it } from 'vitest'
import { mainWindowOptions, shouldUseNativeTitleBar } from 'main_renderer/config'

describe('shouldUseNativeTitleBar', () => {
  it('always enables the native frame on Windows so the application menu is visible', () => {
    expect(shouldUseNativeTitleBar('custom', 'win32')).toBe(true)
  })

  it('preserves the configured title bar style on macOS', () => {
    expect(shouldUseNativeTitleBar('custom', 'darwin')).toBe(false)
    expect(shouldUseNativeTitleBar('native', 'darwin')).toBe(true)
  })

  it('passes the first activation click through to the main window', () => {
    expect(mainWindowOptions.acceptFirstMouse).toBe(true)
  })
})
