import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchElectron } from './helpers'

test.describe('Proplan workspace interactions', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchElectron()
    app = launched.app
    page = launched.page
  })

  test.afterAll(async() => {
    await app.close()
  })

  test('supports manual ordering and timeline date-time ordering', async() => {
    await page.getByRole('button', { name: '新建第一个项目' }).click()
    await page.locator('.project-name-input').fill('项目一')
    await page.getByTitle('新建项目').click()
    await page.locator('.project-name-input').fill('项目二')
    const projectRows = page.locator('.project-row')
    await expect(projectRows).toHaveCount(2)
    await expect(page.locator('.drag-handle')).toHaveCount(0)
    const projectMoveAnimated = await page.evaluate(async() => {
      const rows = document.querySelectorAll<HTMLElement>('.project-row')
      const dataTransfer = new DataTransfer()
      rows[1]?.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }))
      rows[0]?.dispatchEvent(
        new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer })
      )
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      return document.querySelector('.list-reorder-move') !== null
    })
    expect(projectMoveAnimated).toBe(true)
    await expect(projectRows.locator('.row-title')).toHaveText(['项目二', '项目一'])
    await page.evaluate(() =>
      document
        .querySelector<HTMLElement>('.project-row.dragging')
        ?.dispatchEvent(new DragEvent('dragend', { bubbles: true }))
    )

    await page.getByRole('button', { name: '备忘', exact: true }).click()
    await page.getByTitle('新建备忘').click()
    await page.locator('input[aria-label="标题"]').fill('备忘一')
    await page.getByTitle('新建备忘').click()
    await page.locator('input[aria-label="标题"]').fill('备忘二')
    const memoRows = page.locator('.record-row')
    await expect(memoRows).toHaveCount(2)
    await page.evaluate(() => {
      const rows = document.querySelectorAll<HTMLElement>('.record-row')
      const dataTransfer = new DataTransfer()
      rows[1]?.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }))
      rows[0]?.dispatchEvent(
        new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer })
      )
    })
    await expect(memoRows.locator('.row-title')).toHaveText(['备忘一', '备忘二'])
    await page.evaluate(() =>
      document
        .querySelector<HTMLElement>('.record-row.dragging')
        ?.dispatchEvent(new DragEvent('dragend', { bubbles: true }))
    )

    await page.getByRole('button', { name: '任务', exact: true }).click()
    await page.getByTitle('新建任务').click()
    await expect(page.locator('.completion-control')).toHaveCount(0)
    await expect(page.getByLabel('截止日期')).toHaveCount(1)

    await page.getByRole('button', { name: '时间轴', exact: true }).click()
    await page.getByTitle('新建时间节点').click()
    await page.locator('input[aria-label="标题"]').fill('较早节点')
    await page.getByLabel('发生日期和时间').evaluate((element) => {
      const input = element as HTMLInputElement
      input.value = '2026-08-18T09:30'
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await page.getByTitle('新建时间节点').click()
    await page.locator('input[aria-label="标题"]').fill('较晚节点')
    await page.getByLabel('发生日期和时间').evaluate((element) => {
      const input = element as HTMLInputElement
      input.value = '2026-08-20T15:45'
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })

    await expect(page.locator('.record-row .row-title').first()).toHaveText('较晚节点')

    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control'
    await page.keyboard.press(`${modifier}+S`)
    await expect(page.locator('.save-status')).toHaveText(/手动保存成功 \d{2}:\d{2}:\d{2}/)
  })

  test('routes undo and redo shortcuts through the active markdown editor', async() => {
    await page.getByRole('button', { name: '备忘', exact: true }).click()
    await page.getByTitle('新建备忘').click()
    const title = page.locator('input[aria-label="标题"]')
    await title.fill('标题')
    await title.press('End')
    await title.pressSequentially('X')
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control'
    await page.keyboard.press(`${modifier}+Z`)
    await expect(title).toHaveValue('标题')

    const editor = page.locator('.proplan-editor-host [contenteditable="true"]').first()
    await editor.click()
    await page.keyboard.type('撤销快捷键测试')
    await expect(page.locator('.proplan-editor-host')).toContainText('撤销快捷键测试')

    await page.keyboard.press(`${modifier}+Z`)
    await expect(page.locator('.proplan-editor-host')).not.toContainText('撤销快捷键测试')

    const redo = process.platform === 'darwin' ? 'Shift+Meta+Z' : 'Control+Y'
    await page.keyboard.press(redo)
    await expect(page.locator('.proplan-editor-host')).toContainText('撤销快捷键测试')
  })

  test('handles zoom shortcuts before the focused editor can consume them', async() => {
    const modifier: 'meta' | 'control' = process.platform === 'darwin' ? 'meta' : 'control'
    const zoomLevel = (): Promise<number> =>
      app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.webContents.getZoomLevel() ?? 0)
    const sendShortcut = (keyCode: string): Promise<void> =>
      app.evaluate(
        ({ BrowserWindow }, { keyCode, modifier }) => {
          const contents = BrowserWindow.getAllWindows()[0]?.webContents
          contents?.sendInputEvent({ type: 'keyDown', keyCode, modifiers: [modifier] })
          contents?.sendInputEvent({ type: 'keyUp', keyCode, modifiers: [modifier] })
        },
        { keyCode, modifier }
      )

    await sendShortcut('0')
    await expect.poll(zoomLevel).toBe(0)
    await sendShortcut('-')
    await expect.poll(zoomLevel).toBe(-0.5)
    await sendShortcut('=')
    await expect.poll(zoomLevel).toBe(0)
  })

  test('shows fixed common shortcuts in settings', async() => {
    await page.evaluate(() => window.electron.ipcRenderer.send('mt::open-setting-window'))
    await expect.poll(() => app.windows().length).toBe(2)
    const settings = app.windows().find((window) => window !== page)
    if (!settings) throw new Error('settings window did not open')
    await settings.getByText(/快捷键|Keybindings/, { exact: true }).click()
    await expect(settings.locator('.pref-keybindings')).toContainText(/保存|Save/)
    await expect(settings.locator('.pref-keybindings')).toContainText(/撤销|Undo/)
    await expect(settings.locator('.pref-keybindings')).toContainText(/重做|Redo/)
    await expect(settings.locator('.pref-keybindings')).not.toContainText(
      /自定义键盘快捷键|Customize keyboard shortcuts/
    )
    await settings.close()
  })
})
