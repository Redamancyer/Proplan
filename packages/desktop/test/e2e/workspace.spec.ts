import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { launchElectron } from './helpers'

test.describe('Proplan workspace interactions', () => {
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
    await expect(page.locator('.record-row.active')).toHaveAttribute('draggable', 'false')
    const editorScrollbar = await page.locator('.proplan-editor-host').evaluate((element) => {
      const scrollbar = getComputedStyle(element, '::-webkit-scrollbar')
      const track = getComputedStyle(element, '::-webkit-scrollbar-track')
      const thumb = getComputedStyle(element, '::-webkit-scrollbar-thumb')
      return {
        width: scrollbar.width,
        trackRadius: track.borderRadius,
        trackBackground: track.backgroundColor,
        thumbRadius: thumb.borderRadius,
        thumbBorder: thumb.borderWidth,
        thumbBackground: thumb.backgroundColor
      }
    })
    expect(editorScrollbar).toMatchObject({
      width: '9px',
      trackRadius: '999px',
      thumbRadius: '999px',
      thumbBorder: '2px'
    })
    expect(editorScrollbar.trackBackground).not.toBe('rgba(0, 0, 0, 0)')
    expect(editorScrollbar.thumbBackground).not.toBe('rgba(0, 0, 0, 0)')
    const completedDrawer = page.locator('.completed-task-drawer')
    const completedToggle = page.getByRole('button', { name: '已完成' })
    await expect(completedToggle).toHaveAttribute('aria-expanded', 'false')
    await expect(completedToggle.locator('.completed-drawer-icon')).toBeVisible()
    const taskIconsAreDistinct = await page.evaluate(() => {
      const myTasksIcon = document.querySelector('.project-footer button svg')
      const completedIcon = document.querySelector('.completed-drawer-icon')
      return Boolean(
        myTasksIcon && completedIcon && myTasksIcon.innerHTML !== completedIcon.innerHTML
      )
    })
    expect(taskIconsAreDistinct).toBe(true)
    await expect(completedToggle.locator('.drawer-arrow-up')).toBeVisible()
    const collapsedMetrics = await page.evaluate(() => {
      const todoElement = document.querySelector<HTMLElement>('.project-footer button')
      const toggleElement = document.querySelector<HTMLElement>('.completed-drawer-toggle')
      const todo = todoElement?.getBoundingClientRect()
      const footer = document.querySelector<HTMLElement>('.project-footer')?.getBoundingClientRect()
      const toggle = toggleElement?.getBoundingClientRect()
      const stage = document.querySelector<HTMLElement>('.task-list-stage')?.getBoundingClientRect()
      const drawer = document.querySelector<HTMLElement>('.completed-task-drawer')?.getBoundingClientRect()
      return {
        topGap: todo && toggle ? Math.abs(todo.top - toggle.top) : -1,
        bottomGap: todo && toggle ? Math.abs(todo.bottom - toggle.bottom) : -1,
        heightGap: todo && toggle ? Math.abs(todo.height - toggle.height) : -1,
        bottomInset: toggle && stage ? stage.bottom - toggle.bottom : -1,
        dividerGap: footer && drawer ? Math.abs(footer.top - drawer.top) : -1,
        todoInset: footer && todo ? todo.left - footer.left : -1,
        toggleInset: drawer && toggle ? toggle.left - drawer.left : -1,
        todoRadius: todoElement ? getComputedStyle(todoElement).borderRadius : '',
        toggleRadius: toggleElement ? getComputedStyle(toggleElement).borderRadius : '',
        todoFont: todoElement ? getComputedStyle(todoElement).font : '',
        toggleFont: toggleElement ? getComputedStyle(toggleElement).font : '',
        todoGap: todoElement ? getComputedStyle(todoElement).gap : '',
        toggleGap: toggleElement ? getComputedStyle(toggleElement).gap : '',
        drawerTop: drawer?.top ?? 0
      }
    })
    expect(collapsedMetrics.topGap).toBeLessThan(1)
    expect(collapsedMetrics.bottomGap).toBeLessThan(1)
    expect(collapsedMetrics.heightGap).toBeLessThan(1)
    expect(Math.abs(collapsedMetrics.bottomInset - 7)).toBeLessThan(1)
    expect(collapsedMetrics.dividerGap).toBeLessThan(1)
    expect(collapsedMetrics.todoInset).toBe(7)
    expect(collapsedMetrics.toggleInset).toBe(7)
    expect(collapsedMetrics.toggleRadius).toBe(collapsedMetrics.todoRadius)
    expect(collapsedMetrics.toggleFont).toBe(collapsedMetrics.todoFont)
    expect(collapsedMetrics.toggleGap).toBe(collapsedMetrics.todoGap)
    const todoButton = page.locator('.project-footer button')
    await todoButton.hover()
    const todoHoverBackground = await todoButton.evaluate((element) =>
      getComputedStyle(element).backgroundColor
    )
    await completedToggle.hover()
    await expect(completedToggle).toHaveCSS('background-color', todoHoverBackground)
    await completedToggle.click()
    await expect(completedToggle).toHaveAttribute('aria-expanded', 'true')
    await expect(completedToggle.locator('.drawer-arrow-down')).toBeVisible()
    await expect(page.locator('.completed-task-list .empty-records')).toContainText('没有已完成任务')
    await expect.poll(async() =>
      completedDrawer.evaluate((element) => Math.round(element.getBoundingClientRect().top))
    ).toBeLessThan(Math.round(collapsedMetrics.drawerTop))
    await expect.poll(async() => completedDrawer.evaluate((element) => {
      const stage = element.parentElement?.getBoundingClientRect()
      return stage ? Math.abs(element.getBoundingClientRect().top - stage.top) : -1
    })).toBeLessThan(1)
    await completedToggle.click()
    await expect(completedToggle).toHaveAttribute('aria-expanded', 'false')
    await expect(page.locator('.incomplete-task-list .record-row')).toHaveCount(1)
    await page.locator('.record-row').click()
    await expect(page.getByLabel('截止日期')).toHaveCount(1)
    const taskPickerMetrics = await page.locator('.task-date-picker').evaluate((element) => {
      const wrapper = element.querySelector<HTMLElement>('.el-input__wrapper')
      const input = element.querySelector<HTMLElement>('.el-input__inner')
      return {
        width: element.getBoundingClientRect().width,
        wrapperBackground: wrapper ? getComputedStyle(wrapper).backgroundColor : '',
        inputBackground: input ? getComputedStyle(input).backgroundColor : '',
        inputBorderWidth: input ? getComputedStyle(input).borderWidth : ''
      }
    })
    expect(taskPickerMetrics.width).toBeLessThan(120)
    expect(taskPickerMetrics.wrapperBackground).toBe('rgba(0, 0, 0, 0)')
    expect(taskPickerMetrics.inputBackground).toBe('rgba(0, 0, 0, 0)')
    expect(taskPickerMetrics.inputBorderWidth).toBe('0px')
    await page.locator('.task-date-picker').hover()
    await expect(page.locator('.task-date-picker .el-input__wrapper')).not.toHaveCSS(
      'background-color',
      'rgba(0, 0, 0, 0)'
    )
    await page.getByLabel('截止日期').click()
    await expect(page.locator('.el-picker-panel:visible')).toContainText(/\d{4} 年/)
    await expect(page.locator('.el-picker-panel:visible')).toContainText(/\d+ 月/)
    await expect(page.locator('.el-picker-panel:visible')).toContainText('日一二三四五六')
    await page.keyboard.press('Escape')

    const prioritySelect = page.locator('.task-priority-select')
    await expect(prioritySelect).toHaveCSS('width', '58px')
    await expect(prioritySelect.locator('.el-select__placeholder')).toContainText('中')
    await prioritySelect.click()
    const priorityOptions = page.locator('.proplan-priority-popper .el-select-dropdown__item:visible')
    await expect(priorityOptions).toHaveCount(3)
    await expect(priorityOptions).toContainText(['低', '中', '高'])
    await expect(priorityOptions.first()).toHaveCSS('font-size', '11px')
    await expect(priorityOptions.first()).toHaveCSS('height', '26px')
    await priorityOptions.filter({ hasText: '高' }).click()
    await expect(prioritySelect.locator('.el-select__placeholder')).toContainText('高')
    const listPriorityColor = await page.locator('.record-row.active .task-priority-dot')
      .evaluate((element) => getComputedStyle(element).backgroundColor)
    const listPriorityLayout = await page.locator('.record-row.active').evaluate((row) => {
      const copy = row.querySelector<HTMLElement>('.record-copy')?.getBoundingClientRect()
      const dot = row.querySelector<HTMLElement>('.task-priority-dot')?.getBoundingClientRect()
      const bounds = row.getBoundingClientRect()
      return {
        dotAfterCopy: Boolean(copy && dot && dot.left >= copy.right),
        rightInset: dot ? bounds.right - dot.right : 0
      }
    })
    expect(listPriorityLayout.dotAfterCopy).toBe(true)
    expect(listPriorityLayout.rightInset).toBeGreaterThanOrEqual(10)
    expect(listPriorityLayout.rightInset).toBeLessThanOrEqual(16)
    await page.getByLabel('截止日期').click()
    await page.locator('.el-picker-panel:visible td.today').click()
    await expect(page.locator('.record-row.active .row-meta')).not.toContainText('无截止日期')
    await page.getByTitle('关闭编辑器').click()
    const calendarPriorityDot = page.locator('.calendar-task .task-priority-dot').first()
    await expect(calendarPriorityDot).toBeVisible()
    await expect(calendarPriorityDot).toHaveCSS('background-color', listPriorityColor)

    await page.getByRole('button', { name: '时间轴', exact: true }).click()
    await page.getByTitle('新建时间节点').click()
    await page.locator('input[aria-label="标题"]').fill('较早节点')
    const timelinePickerMetrics = await page.locator('.timeline-date-picker').evaluate((element) => {
      const wrapper = element.querySelector<HTMLElement>('.el-input__wrapper')
      const input = element.querySelector<HTMLElement>('.el-input__inner')
      return {
        width: element.getBoundingClientRect().width,
        wrapperBackground: wrapper ? getComputedStyle(wrapper).backgroundColor : '',
        inputBackground: input ? getComputedStyle(input).backgroundColor : '',
        inputBorderWidth: input ? getComputedStyle(input).borderWidth : ''
      }
    })
    expect(timelinePickerMetrics.width).toBeLessThan(160)
    expect(timelinePickerMetrics.width).toBeGreaterThan(taskPickerMetrics.width)
    expect(timelinePickerMetrics.wrapperBackground).toBe('rgba(0, 0, 0, 0)')
    expect(timelinePickerMetrics.inputBackground).toBe('rgba(0, 0, 0, 0)')
    expect(timelinePickerMetrics.inputBorderWidth).toBe('0px')
    await page.locator('.timeline-date-picker').evaluate((element) => {
      const component = (element as Element & { __vueParentComponent?: { emit?: (event: string, value: string) => void } }).__vueParentComponent
      component?.emit?.('update:modelValue', '2026-08-18T09:30')
    })
    await page.getByTitle('新建时间节点').click()
    await page.locator('input[aria-label="标题"]').fill('较晚节点')
    await page.locator('.timeline-date-picker').evaluate((element) => {
      const component = (element as Element & { __vueParentComponent?: { emit?: (event: string, value: string) => void } }).__vueParentComponent
      component?.emit?.('update:modelValue', '2026-08-20T15:45')
    })

    await expect(page.locator('.record-row .row-title').first()).toHaveText('较晚节点')

    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control'
    await page.keyboard.press(`${modifier}+S`)
    await expect(page.locator('.save-status')).toHaveText(
      /手动保存成功 \d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}/
    )

    await page.evaluate(() =>
      window.electron.ipcRenderer.send('mt::set-user-preference', {
        autoSave: true,
        autoSaveDelay: 1000
      })
    )
    await page.locator('.project-description-input').fill('自动保存日期测试')
    await expect(page.locator('.save-status')).toHaveText(
      /自动保存成功 \d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}/
    )

    await page.getByRole('button', { name: '备忘', exact: true }).click()
    await page.locator('.record-row', { hasText: '备忘一' }).click()
    await expect(page.locator('.save-status')).toHaveText(
      /上次保存 \d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}/
    )
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
    const zoomFactor = (): Promise<number> =>
      app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.webContents.getZoomFactor() ?? 1)
    const sendShortcut = (keyCode: string, shift = false): Promise<void> =>
      app.evaluate(
        ({ BrowserWindow }, { keyCode, modifier, shift }) => {
          const contents = BrowserWindow.getAllWindows()[0]?.webContents
          const modifiers: Array<'meta' | 'control' | 'shift'> = shift
            ? [modifier, 'shift']
            : [modifier]
          contents?.sendInputEvent({ type: 'keyDown', keyCode, modifiers })
          contents?.sendInputEvent({ type: 'keyUp', keyCode, modifiers })
        },
        { keyCode, modifier, shift }
      )

    await sendShortcut('0')
    await expect.poll(zoomFactor).toBe(1)
    await sendShortcut('-')
    await expect.poll(zoomFactor).toBe(0.9)
    await sendShortcut('=', true)
    await expect.poll(zoomFactor).toBe(1)
    await sendShortcut('0')
    await sendShortcut('=', true)
    await expect.poll(zoomFactor).toBe(1.1)
  })

  test('applies editor settings to the main window without restarting', async() => {
    await page.getByRole('button', { name: '任务', exact: true }).click()
    await page.locator('.record-row').first().click()
    await expect(page.locator('.mu-container')).toBeVisible()

    await page.evaluate(() => window.electron.ipcRenderer.send('mt::open-setting-window', 'editor'))
    await expect.poll(() => app.windows().length).toBe(2)
    const settings = app.windows().find((window) => window !== page)
    if (!settings) throw new Error('settings window did not open')
    await settings.locator('.category .item', { hasText: '编辑器' }).click()
    await expect(settings.locator('.pref-editor')).toBeVisible()

    const maxWidth = settings.locator('.pref-text-box-item', { hasText: '最大宽度' }).locator('input')
    await maxWidth.fill('640px')
    await expect(page.locator('.mu-container')).toHaveCSS('max-width', '640px')

    const fontSize = settings.locator('.pref-range-item', { hasText: '字体大小' }).first()
    await fontSize.locator('[role="slider"]').press('ArrowUp')
    await expect(page.locator('.mu-container')).toHaveCSS('font-size', '17px')
    await settings.close()
  })

  test('centers settings over the main window and closes it from the backdrop', async() => {
    await page.evaluate(() => window.electron.ipcRenderer.send('mt::open-setting-window'))
    await expect.poll(() => app.windows().length).toBe(2)
    const settings = app.windows().find((window) => window !== page)
    if (!settings) throw new Error('settings window did not open')
    await expect(settings.locator('.pref-container')).toBeVisible()
    await expect(page.locator('.settings-window-backdrop')).toBeVisible()

    const centers = await app.evaluate(({ BrowserWindow }) => {
      const windows = BrowserWindow.getAllWindows()
      const main = windows.find((window) => !window.getParentWindow())?.getBounds()
      const preferences = windows.find((window) => window.getParentWindow())?.getBounds()
      return {
        horizontal: main && preferences
          ? Math.abs(main.x + main.width / 2 - (preferences.x + preferences.width / 2))
          : -1,
        vertical: main && preferences
          ? Math.abs(main.y + main.height / 2 - (preferences.y + preferences.height / 2))
          : -1
      }
    })
    expect(centers.horizontal).toBeLessThanOrEqual(1)
    expect(centers.vertical).toBeLessThanOrEqual(1)

    await page.locator('.settings-window-backdrop').click({ position: { x: 8, y: 8 } })
    await expect.poll(() => app.windows().length).toBe(1)
    await expect(page.locator('.settings-window-backdrop')).toHaveCount(0)
  })

  test('shows fixed common shortcuts in settings', async() => {
    const openSettings = async(): Promise<Page> => {
      await page.evaluate(() => window.electron.ipcRenderer.send('mt::open-setting-window'))
      await expect.poll(() => app.windows().length).toBe(2)
      const settingsWindow = app.windows().find((window) => window !== page)
      if (!settingsWindow) throw new Error('settings window did not open')
      await expect(settingsWindow.locator('.pref-container')).toBeVisible()
      return settingsWindow
    }
    let settings = await openSettings()
    if (!settings) throw new Error('settings window did not open')
    await expect.poll(() =>
      settings.evaluate(() => document.documentElement.classList.contains('preference-window'))
    ).toBe(true)
    const hiddenPreferenceScrollbars = await settings.evaluate(() => {
      const content = document.querySelector('.pref-setting')
      const categories = document.querySelector('.pref-sidebar .category')
      return {
        rootMarked: document.documentElement.classList.contains('preference-window'),
        content: content ? getComputedStyle(content, '::-webkit-scrollbar').display : '',
        categories: categories ? getComputedStyle(categories, '::-webkit-scrollbar').display : ''
      }
    })
    expect(hiddenPreferenceScrollbars).toEqual({
      rootMarked: true,
      content: 'none',
      categories: 'none'
    })
    await expect(page.locator('.proplan-editor-host')).toHaveCSS('scrollbar-width', 'auto')
    const zoom = settings.locator('.pref-range-item', { hasText: '缩放比例' })
    await expect(zoom.locator('.value')).toHaveText('110 %')
    await zoom.locator('[role="slider"]').press('ArrowUp')
    await expect.poll(() =>
      app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().map((window) => window.webContents.getZoomFactor())
      )
    ).toEqual([1.2, 1.2])
    await settings.locator('.pref-general .el-select').click()
    await expect(settings.locator('.el-select-dropdown__item:visible')).toHaveCount(2)
    await settings.locator('.el-select-dropdown__item:visible', { hasText: 'English' }).click()
    await expect(page.locator('.project-description-input')).toHaveAttribute(
      'placeholder',
      'Add project description'
    )
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await settings.close()
    await expect(page.locator('.settings-window-backdrop')).toHaveCount(0)

    await page.getByRole('button', { name: 'Tasks', exact: true }).click()
    await page.locator('.record-row').first().click()
    await page.getByLabel('Due date').click()
    await expect(page.locator('.el-picker-panel:visible')).toContainText('SunMonTueWedThuFriSat')
    await page.keyboard.press('Escape')

    settings = await openSettings()
    await settings.locator('.pref-general .el-select').click()
    await settings.locator('.el-select-dropdown__item:visible', { hasText: '简体中文' }).click()
    await expect(page.locator('.project-description-input')).toHaveAttribute(
      'placeholder',
      '添加项目描述'
    )
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
    await settings.close()
    await expect(page.locator('.settings-window-backdrop')).toHaveCount(0)

    await page.getByLabel('截止日期').click()
    await expect(page.locator('.el-picker-panel:visible')).toContainText('日一二三四五六')
    await page.keyboard.press('Escape')
    await page.getByTitle('关闭编辑器').click()

    await page.getByRole('button', { name: '任务', exact: true }).click()
    await expect(page.locator('.calendar-heading h2')).toContainText('年')
    await expect(page.getByRole('button', { name: '今天', exact: true })).toBeVisible()
    await expect(page.locator('.weekday-row')).toContainText('一')

    settings = await openSettings()
    await settings.getByText(/快捷键|Keybindings/, { exact: true }).click()
    await expect(settings.locator('.pref-keybindings')).toContainText(/保存|Save/)
    await expect(settings.locator('.pref-keybindings')).toContainText(/撤销|Undo/)
    await expect(settings.locator('.pref-keybindings')).toContainText(/重做|Redo/)
    await expect(settings.locator('.pref-keybindings')).not.toContainText(
      /自定义键盘快捷键|Customize keyboard shortcuts/
    )
    await settings.close()
  })

  test('restores the saved zoom factor after relaunching', async() => {
    const modifier: 'meta' | 'control' = process.platform === 'darwin' ? 'meta' : 'control'
    await app.evaluate(
      ({ BrowserWindow }, modifier) => {
        const contents = BrowserWindow.getAllWindows()[0]?.webContents
        contents?.sendInputEvent({ type: 'keyDown', keyCode: '0', modifiers: [modifier] })
        contents?.sendInputEvent({ type: 'keyUp', keyCode: '0', modifiers: [modifier] })
        for (let index = 0; index < 2; index += 1) {
          contents?.sendInputEvent({
            type: 'keyDown',
            keyCode: '=',
            modifiers: [modifier, 'shift']
          })
          contents?.sendInputEvent({
            type: 'keyUp',
            keyCode: '=',
            modifiers: [modifier, 'shift']
          })
        }
      },
      modifier
    )
    await expect.poll(() =>
      app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0]?.webContents.getZoomFactor()
      )
    ).toBe(1.2)

    const userDataDir = await app.evaluate(({ app: electronApp }) =>
      electronApp.getPath('userData')
    )
    const preferencesPath = path.join(userDataDir, 'preferences.json')
    await expect.poll(async() =>
      JSON.parse(await fs.readFile(preferencesPath, 'utf8')).zoomFactor
    ).toBe(1.2)
    await app.close()
    const relaunched = await launchElectron([], userDataDir)
    app = relaunched.app
    page = relaunched.page

    await expect.poll(async() =>
      JSON.parse(await fs.readFile(preferencesPath, 'utf8')).zoomFactor
    ).toBe(1.2)

    await expect.poll(() =>
      app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0]?.webContents.getZoomFactor()
      )
    ).toBe(1.2)
  })
})
