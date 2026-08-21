import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { getElectronPath, launchElectron } from './helpers'

test.describe('Check Launch Proplan', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const { app: electronApp, page: firstPage } = await launchElectron()
    app = electronApp
    page = firstPage
  })

  test.afterAll(async() => {
    await app.close()
  })

  test('Empty Proplan', async() => {
    const title = await page.title()
    expect(/^Proplan|Untitled-1 - Proplan$/.test(title)).toBeTruthy()
  })

  test('shows bundled application and third-party licenses', async() => {
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.webContents.send('mt::about-dialog')
    })
    await expect(page.locator('.el-dialog')).toContainText('关于 Proplan')
    await expect(page.locator('.about-dialog')).toContainText('版本 v1.1.3')
    await expect(page.locator('.about-dialog')).toContainText('Redamancyer')
    await expect(page.locator('.upstream-attribution')).toContainText('基于 MarkText 与 Muya 开发')
    await page.keyboard.press('Escape')
    await expect(page.locator('.el-dialog')).toBeHidden()

    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.webContents.send('mt::about-dialog', 'application')
    })
    await expect(page.locator('.license-document pre')).toContainText('MIT License')

    await page.locator('.back-button').click()
    await page.getByRole('button', { name: '第三方开源许可' }).click()
    await expect(page.locator('.license-document pre')).toContainText(
      'THIRD-PARTY SOFTWARE NOTICES'
    )
    await expect(page.locator('.license-document pre')).toContainText('Package count: 354')
    await page.keyboard.press('Escape')
  })

  test('exposes check for updates in the application menu', async() => {
    const menuLabels = await app.evaluate(({ Menu }) => {
      const collectLabels = (items: Electron.MenuItem[]): string[] =>
        items.flatMap((item) => [item.label, ...(item.submenu ? collectLabels(item.submenu.items) : [])])
      return collectLabels(Menu.getApplicationMenu()?.items ?? [])
    })

    expect(menuLabels.some((label) => /检查更新|Check for Updates/.test(label))).toBe(true)

    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.webContents.send('mt::UPDATE_CHECKING', '正在检查更新…')
    })
    await expect(page.locator('.mt-notification')).toContainText('检查更新')
    await expect(page.locator('.mt-notification')).toContainText('正在检查更新…')
  })

  test('reuses the existing main window when a second instance starts', async() => {
    const userDataDir = await app.evaluate(({ app: electronApp }) =>
      electronApp.getPath('userData')
    )
    const projectRoot = path.resolve(__dirname, '../..')
    const secondInstance = spawn(getElectronPath(), [projectRoot, '--user-data-dir', userDataDir], {
      cwd: projectRoot,
      env: { ...process.env, PERF_TESTING: 'true' },
      stdio: 'ignore'
    })
    const exitCode = await new Promise<number | null>((resolve, reject) => {
      const timer = setTimeout(() => {
        secondInstance.kill()
        reject(new Error('Second Proplan instance did not exit'))
      }, 10_000)
      secondInstance.once('error', reject)
      secondInstance.once('exit', (code) => {
        clearTimeout(timer)
        resolve(code)
      })
    })

    expect(exitCode).toBe(0)
    await expect.poll(() => app.windows().length).toBe(1)
  })
})
