import { describe, expect, it, vi } from 'vitest'

// Proplan uses a native edit menu and does not expose MarkText-only editor
// actions such as screenshots, paragraph duplication, or file search.

vi.mock('electron', () => ({}))
vi.mock('main_renderer/menu/actions/edit', () => ({}))
vi.mock('main_renderer/i18n', () => ({ t: (key: string) => key }))
vi.mock('main_renderer/commands', () => ({
  COMMANDS: new Proxy({}, { get: () => 'cmd' })
}))

const keybindings = { getAccelerator: () => undefined } as never

interface Item { type?: string, visible?: boolean, id?: string, role?: string }

async function buildEditSubmenu(isOsx: boolean): Promise<Item[]> {
  vi.resetModules()
  vi.doMock('main_renderer/config', () => ({ isOsx }))
  const mod = await import('main_renderer/menu/templates/edit')
  return (mod.default(keybindings).submenu as Item[])
}

const hasAdjacentVisibleSeparators = (items: Item[]): boolean => {
  const visible = items.filter(i => i.visible !== false)
  return visible.some((item, i) =>
    item.type === 'separator' && visible[i + 1]?.type === 'separator'
  )
}

describe('Proplan edit menu', () => {
  it.each([false, true])('contains only native editing commands (isOsx=%s)', async(isOsx) => {
    const submenu = await buildEditSubmenu(isOsx)
    expect(submenu.filter(item => item.type !== 'separator').map(item => item.role)).toEqual([
      'undo',
      'redo',
      'cut',
      'copy',
      'paste',
      'selectAll'
    ])
    expect(submenu.some(item => item.id === 'screenshot')).toBe(false)
    expect(hasAdjacentVisibleSeparators(submenu)).toBe(false)
  })
})
