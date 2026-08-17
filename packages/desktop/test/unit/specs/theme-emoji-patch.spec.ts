import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.hoisted(() => {
  const w = globalThis as unknown as {
    window?: { electron?: { process: { platform: NodeJS.Platform } } }
  }
  w.window ??= {}
  w.window.electron ??= { process: { platform: 'linux' } }
})

const EMOJI_SELECTOR = '.mu-emoji-picker section .emoji-wrapper .item span'
const EMOJI_FONT = 'Noto Color Emoji'

const loadTheme = async(isLinux: boolean) => {
  vi.resetModules()
  window.electron.process.platform = isLinux ? 'linux' : 'darwin'
  return await import('@/util/theme')
}

const commonStyleHtml = () =>
  (document.querySelector('#ag-common-style') as HTMLStyleElement | null)?.innerHTML ?? ''

const commonOptions = { codeFontFamily: 'Fira Code', codeFontSize: 14 }

describe('theme.ts emoji-picker Linux font patch', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
    document.body.className = ''
  })

  afterEach(() => undefined)

  it('injects the .mu-emoji-picker font fallback into the common sheet on Linux', async() => {
    const { addCommonStyle } = await loadTheme(true)
    addCommonStyle(commonOptions)

    const css = commonStyleHtml()
    expect(css).toContain(EMOJI_SELECTOR)
    expect(css).toContain(EMOJI_FONT)
    expect(css).toContain(`${EMOJI_SELECTOR} { font-family: sans-serif, "${EMOJI_FONT}"; }`)
  })

  it('omits the emoji patch entirely off Linux', async() => {
    const { addCommonStyle } = await loadTheme(false)
    addCommonStyle(commonOptions)

    const css = commonStyleHtml()
    expect(css).not.toContain('.mu-emoji-picker')
    expect(css).not.toContain(EMOJI_FONT)
  })

  it('keeps targeting the engine .mu-emoji-picker selector (not a legacy ag-* class) on Linux', async() => {
    const { addCommonStyle } = await loadTheme(true)
    addCommonStyle(commonOptions)

    const css = commonStyleHtml()
    expect(css).toContain('.mu-emoji-picker')
    expect(css).not.toContain('.ag-emoji-picker')
  })

  it('routes the patch through addStyles (theme + common) on Linux', async() => {
    const { addStyles } = await loadTheme(true)
    addStyles({ theme: 'light', ...commonOptions })

    expect(commonStyleHtml()).toContain(EMOJI_SELECTOR)
    // The theme sheet itself carries the theme CSS, not the emoji patch.
    const themeHtml = (document.querySelector('#ag-theme') as HTMLStyleElement | null)?.innerHTML
    expect(themeHtml).not.toContain('.mu-emoji-picker')
  })

  it('routes nothing emoji-related through addStyles off Linux', async() => {
    const { addStyles } = await loadTheme(false)
    addStyles({ theme: 'light', ...commonOptions })

    expect(commonStyleHtml()).not.toContain('.mu-emoji-picker')
  })
})
