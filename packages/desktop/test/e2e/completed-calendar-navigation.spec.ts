import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchElectron } from './helpers'

test.describe('Completed task calendar navigation', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchElectron()
    app = launched.app
    page = launched.page
    await page.evaluate(() =>
      window.electron.ipcRenderer.send('mt::set-user-preference', { language: 'zh-CN' })
    )
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  })

  test.afterAll(async() => {
    await app.close()
  })

  test('expands and selects a completed task clicked in the calendar', async() => {
    await page.getByRole('button', { name: '新建第一个项目' }).click()
    await page.getByRole('button', { name: '任务', exact: true }).click()
    await page.getByTitle('新建任务').click()
    await page.locator('input[aria-label="标题"]').fill('日历已完成任务')
    await page.getByLabel('截止日期').click()
    await page.locator('.el-picker-panel:visible td.today').click()

    await page.locator('.incomplete-task-list .record-row .task-check').click()
    await page.getByTitle('关闭编辑器').click()
    const completedCalendarTask = page.locator('.calendar-task.completed', {
      hasText: '日历已完成任务'
    })
    await expect(completedCalendarTask).toBeVisible()

    await completedCalendarTask.click()

    await expect(page.getByRole('button', { name: '已完成', exact: true })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    const selectedTask = page.locator('.completed-task-list .record-row.active')
    await expect(selectedTask).toHaveCount(1)
    await expect(selectedTask).toBeVisible()
    await expect(selectedTask).toContainText('日历已完成任务')
    await expect(page.locator('input[aria-label="标题"]')).toHaveValue('日历已完成任务')
  })
})
