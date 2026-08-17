import { describe, expect, it } from 'vitest'
import { shouldExitFullScreen } from 'main_renderer/windows/fullscreen'

describe('Windows full-screen escape shortcut', () => {
  it('exits full screen on Escape keydown', () => {
    expect(shouldExitFullScreen({ type: 'keyDown', key: 'Escape' }, true)).toBe(true)
  })

  it('does not consume Escape outside full screen', () => {
    expect(shouldExitFullScreen({ type: 'keyDown', key: 'Escape' }, false)).toBe(false)
  })

  it('ignores other input events while full screen', () => {
    expect(shouldExitFullScreen({ type: 'keyUp', key: 'Escape' }, true)).toBe(false)
    expect(shouldExitFullScreen({ type: 'keyDown', key: 'Enter' }, true)).toBe(false)
  })
})
