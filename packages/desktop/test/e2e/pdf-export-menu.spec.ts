import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { launchElectron } from './helpers'

test.describe('PDF export context menu', () => {
  let app: ElectronApplication
  let page: Page
  let exportDirectory: string
  let exportPath: string

  test.beforeAll(async() => {
    const launched = await launchElectron()
    app = launched.app
    page = launched.page
    exportDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'proplan-pdf-e2e-'))
    exportPath = path.join(exportDirectory, '时间轴导出.pdf')
    await page.evaluate(() =>
      window.electron.ipcRenderer.send('mt::set-user-preference', { language: 'zh-CN' })
    )
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  })

  test.afterAll(async() => {
    await app.close()
    fs.rmSync(exportDirectory, { recursive: true, force: true })
  })

  test('shows export for memos, tasks, and timeline entries only', async() => {
    await page.getByRole('button', { name: '新建第一个项目' }).click()

    const projectRow = page.locator('.project-row').first()
    await projectRow.click({ button: 'right' })
    await expect(page.getByRole('menuitem', { name: '删除' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: '导出' })).toHaveCount(0)
    await page.keyboard.press('Escape')

    for (const entry of [
      { section: '备忘', create: '新建备忘' },
      { section: '任务', create: '新建任务' },
      { section: '时间轴', create: '新建时间节点' }
    ]) {
      await page.getByRole('button', { name: entry.section, exact: true }).click()
      await page.getByTitle(entry.create).click()
      await page.locator('.record-row').first().click({ button: 'right' })
      await expect(page.getByRole('menuitem', { name: '导出' })).toBeVisible()
      await expect(page.getByRole('menuitem', { name: '删除' })).toBeVisible()
      await page.keyboard.press('Escape')
    }

    await app.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = async() => ({ canceled: false, filePath })
    }, exportPath)
    await page.locator('.record-row').first().click({ button: 'right' })
    await page.getByRole('menuitem', { name: '导出' }).click()
    const successNotification = page.locator('.mt-notification.mt-success')
    await expect(successNotification).toContainText('导出成功')
    await expect(successNotification.locator('.notification-icon path')).toHaveAttribute(
      'd',
      'm5 12 4 4L19 6'
    )
    await expect(successNotification.locator('.notice-bg')).toHaveCSS(
      'background-color',
      'rgb(32, 178, 107)'
    )
    await expect.poll(() => fs.existsSync(exportPath)).toBe(true)

    const pdf = fs.readFileSync(exportPath)
    expect(pdf.byteLength).toBeGreaterThan(1000)
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
  })
})
