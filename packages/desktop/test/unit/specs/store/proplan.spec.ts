import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyProplanDatabase, type ProplanDatabase } from '@shared/types/proplan'
import { useProplanStore } from '@/store/proplan'
import { usePreferencesStore } from '@/store/preferences'

const load = vi.fn<() => Promise<ProplanDatabase>>()
const save = vi.fn<(database: ProplanDatabase) => Promise<void>>()

describe('proplan store', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    load.mockReset().mockResolvedValue(createEmptyProplanDatabase())
    save.mockReset().mockResolvedValue()
    Object.defineProperty(window, 'proplan', {
      configurable: true,
      value: { load, save }
    })
    setActivePinia(createPinia())
    const preferences = usePreferencesStore()
    preferences.autoSave = true
    preferences.autoSaveDelay = 1000
  })

  it('creates projects and each supported record type', async() => {
    vi.setSystemTime(new Date('2026-08-17T02:03:04.000Z'))
    const store = useProplanStore()
    await store.initialize()

    const project = store.createProject()
    store.updateProject(project.id, { name: '桌面端重构' })
    const memo = store.createRecord('memos')
    const task = store.createRecord('tasks')
    const timeline = store.createRecord('timeline')

    expect(store.selectedProject?.name).toBe('桌面端重构')
    expect(memo && 'markdown' in memo).toBe(true)
    expect(task && 'completed' in task).toBe(true)
    expect(task && 'priority' in task).toBe(false)
    expect(timeline && 'occurredAt' in timeline).toBe(true)
    expect(timeline && 'occurredAt' in timeline ? timeline.occurredAt : null).toBe(
      '2026-08-17T02:03:04.000Z'
    )
    expect(project.memos).toHaveLength(1)
    expect(project.tasks).toHaveLength(1)
    expect(project.timeline).toHaveLength(1)
  })

  it('selects and edits markdown for tasks and timeline entries', async() => {
    const store = useProplanStore()
    await store.initialize()
    store.createProject()
    const task = store.createRecord('tasks')
    const timeline = store.createRecord('timeline')
    if (!task || !timeline) throw new Error('expected records')

    store.setView('tasks')
    store.selectRecord(task.id)
    store.updateSelectedRecord({ markdown: '## 任务说明\n\n- [ ] 子任务' })

    store.setView('timeline')
    store.selectRecord(timeline.id)
    store.updateSelectedRecord({ markdown: '## 里程碑\n\n时间轴正文' })

    expect(store.database.projects[0]?.tasks[0]?.markdown).toContain('任务说明')
    expect(store.database.projects[0]?.timeline[0]?.markdown).toContain('里程碑')
  })

  it('honors the auto-save preference while preserving explicit saves', async() => {
    const preferences = usePreferencesStore()
    preferences.autoSave = false
    const store = useProplanStore()
    await store.initialize()

    store.createProject()
    store.createRecord('memos')
    await vi.advanceTimersByTimeAsync(2000)
    expect(save).not.toHaveBeenCalled()

    await store.flushSave()
    expect(save).toHaveBeenCalledOnce()
  })

  it('skips unchanged auto-saves and records successful save kind and time', async() => {
    vi.setSystemTime(new Date('2026-08-18T08:09:10.000Z'))
    const store = useProplanStore()
    await store.initialize()

    await expect(store.flushSave('auto')).resolves.toBe(false)
    expect(save).not.toHaveBeenCalled()

    const project = store.createProject()
    await vi.advanceTimersByTimeAsync(1000)
    expect(save).toHaveBeenCalledOnce()
    expect(store.lastSaveKind).toBe('auto')
    expect(store.lastSavedAt?.toISOString()).toBe('2026-08-18T08:09:11.000Z')
    expect(store.hasUnsavedChanges).toBe(false)

    save.mockClear()
    store.updateProject(project.id, { name: project.name })
    await vi.advanceTimersByTimeAsync(2000)
    expect(save).not.toHaveBeenCalled()

    await expect(store.flushSave('manual')).resolves.toBe(true)
    expect(save).toHaveBeenCalledOnce()
    expect(store.lastSaveKind).toBe('manual')
  })

  it('reports explicit save failures to callers and keeps the error message', async() => {
    const store = useProplanStore()
    await store.initialize()
    store.createProject()
    save.mockRejectedValueOnce(new Error('磁盘已满'))

    await expect(store.flushSave()).rejects.toThrow('磁盘已满')

    expect(store.saveError).toBe('磁盘已满')
    expect(store.saving).toBe(false)
  })

  it('shows the project overview after switching sections or closing an editor', async() => {
    const store = useProplanStore()
    await store.initialize()
    const project = store.createProject()
    const memo = store.createRecord('memos')
    if (!memo) throw new Error('expected memo')

    store.setView('tasks')
    expect(store.selectedRecord).toBeNull()

    store.setView('memos')
    store.selectRecord(memo.id)
    expect(store.selectedRecord?.id).toBe(memo.id)

    store.clearSelectedRecord()
    expect(store.selectedRecord).toBeNull()

    store.selectProject(project.id)
    expect(store.selectedRecord).toBeNull()
  })

  it('deletes any record by id and clears its active editor', async() => {
    const store = useProplanStore()
    await store.initialize()
    const project = store.createProject()
    const memo = store.createRecord('memos')
    const task = store.createRecord('tasks')
    const timeline = store.createRecord('timeline')
    if (!memo || !task || !timeline) throw new Error('expected records')

    store.deleteRecord(task.id)
    expect(project.tasks).toHaveLength(0)
    expect(project.memos).toHaveLength(1)
    expect(project.timeline).toHaveLength(1)

    store.setView('memos')
    store.selectRecord(memo.id)
    store.deleteRecord(memo.id)
    expect(project.memos).toHaveLength(0)
    expect(store.selectedRecord).toBeNull()

    store.deleteRecord(timeline.id)
    expect(project.timeline).toHaveLength(0)
  })

  it('hides completed tasks from my tasks while retaining project history', async() => {
    const store = useProplanStore()
    await store.initialize()
    const project = store.createProject()
    store.updateProject(project.id, { name: '发布计划' })
    const task = store.createRecord('tasks')
    if (!task || !('completed' in task)) throw new Error('expected task')

    store.updateSelectedRecord({ title: '打包 macOS 应用' })
    store.setView('globalTasks')

    expect(store.globalTasks[0]?.projectName).toBe('发布计划')
    expect(store.selectedRecord).toBeNull()

    store.selectRecord(task.id)
    store.toggleTask(task.id)

    expect(store.globalTasks).toHaveLength(0)
    expect(store.records).toHaveLength(0)
    expect(store.selectedRecord).toBeNull()
    expect(store.database.projects[0]?.tasks[0]?.completed).toBe(true)

    await vi.advanceTimersByTimeAsync(1100)
    expect(save).toHaveBeenCalled()
    expect(save.mock.lastCall?.[0].projects[0]?.tasks[0]?.title).toBe('打包 macOS 应用')
  })

  it('filters my tasks by the local due date', async() => {
    vi.setSystemTime(new Date(2026, 7, 14, 12))
    const store = useProplanStore()
    await store.initialize()
    store.createProject()
    const todayTask = store.createRecord('tasks')
    if (!todayTask || !('completed' in todayTask)) throw new Error('expected task')
    store.updateSelectedRecord({ title: '今天完成', dueAt: '2026-08-14' })
    const laterTask = store.createRecord('tasks')
    if (!laterTask || !('completed' in laterTask)) throw new Error('expected task')
    store.updateSelectedRecord({ title: '以后完成', dueAt: '2026-08-20' })

    store.setView('globalTasks')
    expect(store.globalTaskFilter).toBe('all')
    expect(store.selectedRecord).toBeNull()
    expect(store.records).toHaveLength(2)

    store.setGlobalTaskFilter('today')
    expect(store.records.map((record) => record.title)).toEqual(['今天完成'])
    store.selectRecord(laterTask.id)
    expect(store.selectedRecord?.title).toBe('以后完成')
  })

  it('refreshes today-filtered tasks after the local date changes', async() => {
    vi.setSystemTime(new Date(2026, 7, 14, 23, 59))
    const store = useProplanStore()
    await store.initialize()
    store.createProject()
    const task = store.createRecord('tasks')
    if (!task || !('completed' in task)) throw new Error('expected task')
    store.updateSelectedRecord({ title: '明天完成', dueAt: '2026-08-15' })
    store.setView('globalTasks')
    store.setGlobalTaskFilter('today')
    expect(store.records).toHaveLength(0)

    vi.setSystemTime(new Date(2026, 7, 15, 0, 1))
    store.refreshCurrentDate()

    expect(store.currentDateKey).toBe('2026-08-15')
    expect(store.records.map((record) => record.title)).toEqual(['明天完成'])
  })

  it('persists project, record, and global task drag ordering', async() => {
    const store = useProplanStore()
    await store.initialize()
    const firstProject = store.createProject()
    store.updateProject(firstProject.id, { name: '项目一' })
    const firstMemo = store.createRecord('memos')
    const secondMemo = store.createRecord('memos')
    const firstTask = store.createRecord('tasks')
    if (!firstMemo || !secondMemo || !firstTask || !('completed' in firstTask)) {
      throw new Error('expected records')
    }

    const secondProject = store.createProject()
    store.updateProject(secondProject.id, { name: '项目二' })
    const secondTask = store.createRecord('tasks')
    if (!secondTask || !('completed' in secondTask)) throw new Error('expected task')

    store.reorderProjects(secondProject.id, firstProject.id)
    expect(store.projects.map((project) => project.name)).toEqual(['项目二', '项目一'])

    store.selectProject(firstProject.id)
    store.setView('memos')
    store.reorderRecords(firstMemo.id, secondMemo.id)
    expect(store.records.map((record) => record.id)).toEqual([firstMemo.id, secondMemo.id])

    store.setView('globalTasks')
    store.reorderGlobalTasks(firstTask.id, secondTask.id)
    expect(store.records.map((record) => record.id)).toEqual([firstTask.id, secondTask.id])
    expect(store.database.globalTaskOrder.slice(0, 2)).toEqual([firstTask.id, secondTask.id])
  })

  it('sorts timeline entries by their selected date and time', async() => {
    const store = useProplanStore()
    await store.initialize()
    store.createProject()
    const older = store.createRecord('timeline')
    const newer = store.createRecord('timeline')
    if (!older || !newer || !('occurredAt' in older) || !('occurredAt' in newer)) {
      throw new Error('expected timeline entries')
    }

    store.selectRecord(older.id)
    store.updateSelectedRecord({ occurredAt: '2026-08-18T09:30' })
    store.selectRecord(newer.id)
    store.updateSelectedRecord({ occurredAt: '2026-08-20T15:45' })

    expect(store.records.map((record) => record.id)).toEqual([newer.id, older.id])
  })

  it('reorders only the visible slots in the today task list', async() => {
    vi.setSystemTime(new Date(2026, 7, 17, 12))
    const store = useProplanStore()
    await store.initialize()
    store.createProject()
    const firstToday = store.createRecord('tasks')
    const later = store.createRecord('tasks')
    const secondToday = store.createRecord('tasks')
    if (
      !firstToday ||
      !later ||
      !secondToday ||
      !('completed' in firstToday) ||
      !('completed' in later) ||
      !('completed' in secondToday)
    ) {
      throw new Error('expected tasks')
    }
    store.selectRecord(firstToday.id)
    store.updateSelectedRecord({ dueAt: '2026-08-17' })
    store.selectRecord(later.id)
    store.updateSelectedRecord({ dueAt: '2026-08-20' })
    store.selectRecord(secondToday.id)
    store.updateSelectedRecord({ dueAt: '2026-08-17' })

    store.setView('globalTasks')
    store.setGlobalTaskFilter('today')
    store.reorderGlobalTasks(firstToday.id, secondToday.id)

    expect(store.records.map((record) => record.id)).toEqual([firstToday.id, secondToday.id])
    expect(store.database.globalTaskOrder).toEqual([firstToday.id, later.id, secondToday.id])
  })
})
