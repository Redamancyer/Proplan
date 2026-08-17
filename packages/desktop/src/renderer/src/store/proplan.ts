import { computed, ref, toRaw } from 'vue'
import { defineStore } from 'pinia'
import { usePreferencesStore } from './preferences'
import {
  createEmptyProplanDatabase,
  type ProplanDatabase,
  type ProplanMemo,
  type ProplanProject,
  type ProplanSection,
  type ProplanTask,
  type ProplanTimelineEntry
} from '@shared/types/proplan'

export type ProplanView = ProplanSection | 'globalTasks'
export type ProplanRecord = ProplanMemo | ProplanTask | ProplanTimelineEntry
export type GlobalTaskFilter = 'all' | 'today'

export interface GlobalTaskItem {
  projectId: string
  projectName: string
  projectColor: string
  task: ProplanTask
}

const PROJECT_COLORS = ['#4f7c6a', '#476d8c', '#8b6755', '#806790', '#9a7440', '#5f6b72']

const newId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`

const now = (): string => new Date().toISOString()
const localDateKey = (date = new Date()): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const cloneDatabase = (database: ProplanDatabase): ProplanDatabase =>
  JSON.parse(JSON.stringify(toRaw(database))) as ProplanDatabase

export const useProplanStore = defineStore('proplan', () => {
  const preferences = usePreferencesStore()
  const database = ref<ProplanDatabase>(createEmptyProplanDatabase())
  const loaded = ref(false)
  const saving = ref(false)
  const saveError = ref('')
  const currentDateKey = ref(localDateKey())
  const selectedProjectId = ref<string | null>(null)
  const selectedRecordId = ref<string | null>(null)
  const view = ref<ProplanView>('memos')
  const globalTaskFilter = ref<GlobalTaskFilter>('all')
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  const projects = computed(() => database.value.projects)
  const selectedProject = computed(
    () => projects.value.find((project) => project.id === selectedProjectId.value) ?? null
  )
  const allGlobalTasks = computed<GlobalTaskItem[]>(() =>
    projects.value
      .flatMap((project) =>
        project.tasks.map((task) => ({
          projectId: project.id,
          projectName: project.name,
          projectColor: project.color,
          task
        }))
      )
      .sort((a, b) => {
        if (a.task.completed !== b.task.completed) return a.task.completed ? 1 : -1
        if (a.task.dueAt && b.task.dueAt) return a.task.dueAt.localeCompare(b.task.dueAt)
        if (a.task.dueAt) return -1
        if (b.task.dueAt) return 1
        return b.task.updatedAt.localeCompare(a.task.updatedAt)
      })
  )
  const globalTasks = computed<GlobalTaskItem[]>(() =>
    allGlobalTasks.value.filter(({ task }) => !task.completed)
  )

  const records = computed<ProplanRecord[]>(() => {
    if (view.value === 'globalTasks') {
      const tasks = globalTasks.value.map((item) => item.task)
      return globalTaskFilter.value === 'today'
        ? tasks.filter((task) => task.dueAt === currentDateKey.value)
        : tasks
    }
    return selectedProject.value?.[view.value] ?? []
  })

  const selectedRecord = computed<ProplanRecord | null>(() => {
    if (!selectedRecordId.value) return null
    if (view.value === 'globalTasks') {
      return globalTasks.value.find(({ task }) => task.id === selectedRecordId.value)?.task ?? null
    }
    return records.value.find((record) => record.id === selectedRecordId.value) ?? null
  })

  const selectedRecordProject = computed<ProplanProject | null>(() => {
    if (view.value !== 'globalTasks') return selectedProject.value
    const item = globalTasks.value.find(({ task }) => task.id === selectedRecordId.value)
    return projects.value.find((project) => project.id === item?.projectId) ?? null
  })

  const flushSave = async(): Promise<void> => {
    if (!loaded.value) return
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    saving.value = true
    saveError.value = ''
    try {
      await window.proplan.save(cloneDatabase(database.value))
    } catch (error) {
      saveError.value = error instanceof Error ? error.message : String(error)
      throw error
    } finally {
      saving.value = false
    }
  }

  const scheduleSave = (): void => {
    if (!loaded.value) return
    if (saveTimer) clearTimeout(saveTimer)
    if (!preferences.autoSave) {
      saveTimer = null
      return
    }
    saveTimer = setTimeout(() => {
      flushSave().catch(() => undefined)
    }, Math.max(1000, preferences.autoSaveDelay))
  }

  const touchProject = (project: ProplanProject): void => {
    project.updatedAt = now()
    scheduleSave()
  }

  const initialize = async(): Promise<void> => {
    if (loaded.value) return
    database.value = await window.proplan.load()
    selectedProjectId.value = database.value.projects[0]?.id ?? null
    selectedRecordId.value = null
    loaded.value = true
  }

  const reloadFromDisk = async(): Promise<void> => {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    database.value = await window.proplan.load()
    selectedProjectId.value = database.value.projects[0]?.id ?? null
    selectedRecordId.value = null
    view.value = 'memos'
    globalTaskFilter.value = 'all'
    loaded.value = true
    saveError.value = ''
  }

  const selectProject = (projectId: string): void => {
    selectedProjectId.value = projectId
    if (view.value === 'globalTasks') view.value = 'memos'
    selectedRecordId.value = null
  }

  const setView = (nextView: ProplanView): void => {
    view.value = nextView
    if (nextView === 'globalTasks') {
      globalTaskFilter.value = 'all'
    }
    selectedRecordId.value = null
  }

  const setGlobalTaskFilter = (filter: GlobalTaskFilter): void => {
    globalTaskFilter.value = filter
    selectedRecordId.value = null
  }

  const selectRecord = (recordId: string): void => {
    const availableRecords =
      view.value === 'globalTasks' ? globalTasks.value.map(({ task }) => task) : records.value
    selectedRecordId.value = availableRecords.some((record) => record.id === recordId)
      ? recordId
      : null
  }

  const clearSelectedRecord = (): void => {
    selectedRecordId.value = null
  }

  const refreshCurrentDate = (): void => {
    currentDateKey.value = localDateKey()
  }

  const createProject = (): ProplanProject => {
    const timestamp = now()
    const project: ProplanProject = {
      id: newId(),
      name: '未命名项目',
      description: '',
      color: PROJECT_COLORS[projects.value.length % PROJECT_COLORS.length] ?? '#4f7c6a',
      createdAt: timestamp,
      updatedAt: timestamp,
      memos: [],
      tasks: [],
      timeline: []
    }
    database.value.projects.push(project)
    selectedProjectId.value = project.id
    selectedRecordId.value = null
    view.value = 'memos'
    scheduleSave()
    return project
  }

  const updateProject = (
    projectId: string,
    patch: Partial<Pick<ProplanProject, 'name' | 'description' | 'color'>>
  ): void => {
    const project = projects.value.find((item) => item.id === projectId)
    if (!project) return
    Object.assign(project, patch)
    touchProject(project)
  }

  const deleteProject = (projectId: string): void => {
    const index = projects.value.findIndex((project) => project.id === projectId)
    if (index < 0) return
    database.value.projects.splice(index, 1)
    if (selectedProjectId.value === projectId) {
      const next = projects.value[Math.min(index, projects.value.length - 1)] ?? null
      selectedProjectId.value = next?.id ?? null
      selectedRecordId.value = null
      view.value = 'memos'
    }
    scheduleSave()
  }

  const createRecord = (
    section: ProplanSection = view.value === 'globalTasks' ? 'tasks' : view.value
  ): ProplanRecord | null => {
    const project = selectedProject.value
    if (!project) return null
    const timestamp = now()
    const base = { id: newId(), markdown: '', createdAt: timestamp, updatedAt: timestamp }
    let record: ProplanRecord
    if (section === 'tasks') {
      record = {
        ...base,
        title: '新任务',
        completed: false,
        dueAt: null,
        completedAt: null
      }
      project.tasks.unshift(record)
    } else if (section === 'timeline') {
      record = { ...base, title: '新时间节点', occurredAt: timestamp }
      project.timeline.unshift(record)
    } else {
      record = { ...base, title: '新备忘' }
      project.memos.unshift(record)
    }
    view.value = section
    selectedRecordId.value = record.id
    touchProject(project)
    return record
  }

  const updateSelectedRecord = (
    patch: Partial<ProplanMemo & ProplanTask & ProplanTimelineEntry>
  ): void => {
    const record = selectedRecord.value
    const project = selectedRecordProject.value
    if (!record || !project) return
    Object.assign(record, patch, { updatedAt: now() })
    touchProject(project)
  }

  const toggleTask = (taskId: string): void => {
    const item = allGlobalTasks.value.find(({ task }) => task.id === taskId)
    const project = item
      ? projects.value.find((entry) => entry.id === item.projectId)
      : selectedProject.value
    const task = project?.tasks.find((entry) => entry.id === taskId)
    if (!project || !task) return
    task.completed = !task.completed
    task.completedAt = task.completed ? now() : null
    task.updatedAt = now()
    touchProject(project)
  }

  const deleteRecord = (recordId: string): void => {
    for (const project of projects.value) {
      for (const section of ['memos', 'tasks', 'timeline'] as const) {
        const list = project[section] as ProplanRecord[]
        const index = list.findIndex((record) => record.id === recordId)
        if (index < 0) continue
        list.splice(index, 1)
        if (selectedRecordId.value === recordId) selectedRecordId.value = null
        touchProject(project)
        return
      }
    }
  }

  const deleteSelectedRecord = (): void => {
    if (selectedRecordId.value) deleteRecord(selectedRecordId.value)
  }

  return {
    database,
    projects,
    loaded,
    saving,
    saveError,
    currentDateKey,
    selectedProjectId,
    selectedRecordId,
    selectedProject,
    selectedRecord,
    selectedRecordProject,
    records,
    globalTasks,
    globalTaskFilter,
    view,
    initialize,
    reloadFromDisk,
    selectProject,
    setView,
    setGlobalTaskFilter,
    selectRecord,
    clearSelectedRecord,
    refreshCurrentDate,
    createProject,
    updateProject,
    deleteProject,
    createRecord,
    updateSelectedRecord,
    toggleTask,
    deleteRecord,
    deleteSelectedRecord,
    flushSave
  }
})
