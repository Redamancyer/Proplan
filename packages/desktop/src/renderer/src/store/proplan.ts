import { computed, ref, toRaw } from 'vue'
import { defineStore } from 'pinia'
import { usePreferencesStore } from './preferences'
import { systemTextForLocale } from '@/util/systemLocale'
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
export type ProplanSaveKind = 'auto' | 'manual'

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
const databaseSnapshot = (database: ProplanDatabase): string => JSON.stringify(toRaw(database))

const sortTimeline = (project: ProplanProject): void => {
  project.timeline.sort((a, b) => {
    const aTime = Date.parse(a.occurredAt)
    const bTime = Date.parse(b.occurredAt)
    if (!Number.isNaN(aTime) && !Number.isNaN(bTime) && aTime !== bTime) return bTime - aTime
    return b.occurredAt.localeCompare(a.occurredAt)
  })
}

const moveBefore = <T>(items: T[], sourceIndex: number, targetIndex: number): void => {
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return
  const [item] = items.splice(sourceIndex, 1)
  if (item === undefined) return
  items.splice(targetIndex, 0, item)
}

export const useProplanStore = defineStore('proplan', () => {
  const preferences = usePreferencesStore()
  const database = ref<ProplanDatabase>(createEmptyProplanDatabase())
  const loaded = ref(false)
  const saving = ref(false)
  const saveError = ref('')
  const lastSavedAt = ref<Date | null>(null)
  const lastSaveKind = ref<ProplanSaveKind | null>(null)
  const currentDateKey = ref(localDateKey())
  const selectedProjectId = ref<string | null>(null)
  const selectedRecordId = ref<string | null>(null)
  const view = ref<ProplanView>('memos')
  const globalTaskFilter = ref<GlobalTaskFilter>('all')
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  const lastSavedSnapshot = ref('')
  const savedRecordTimes = new Map<string, string>()

  const refreshSavedRecordTimes = (): void => {
    savedRecordTimes.clear()
    for (const project of database.value.projects) {
      for (const record of [...project.memos, ...project.tasks, ...project.timeline]) {
        savedRecordTimes.set(record.id, record.updatedAt)
      }
    }
  }

  const showRecordSavedTime = (recordId: string, fallback = new Date()): void => {
    const savedAt = new Date(savedRecordTimes.get(recordId) ?? '')
    lastSavedAt.value = Number.isNaN(savedAt.getTime()) ? fallback : savedAt
    lastSaveKind.value = null
  }

  const projects = computed(() => database.value.projects)
  const selectedProject = computed(
    () => projects.value.find((project) => project.id === selectedProjectId.value) ?? null
  )
  const allGlobalTasks = computed<GlobalTaskItem[]>(() => {
    const positions = new Map(database.value.globalTaskOrder.map((id, index) => [id, index]))
    return projects.value
      .flatMap((project) =>
        project.tasks.map((task) => ({
          projectId: project.id,
          projectName: project.name,
          projectColor: project.color,
          task
        }))
      )
      .sort(
        (a, b) =>
          (positions.get(a.task.id) ?? Number.MAX_SAFE_INTEGER) -
          (positions.get(b.task.id) ?? Number.MAX_SAFE_INTEGER)
      )
  })
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
  const hasUnsavedChanges = computed(
    () => loaded.value && databaseSnapshot(database.value) !== lastSavedSnapshot.value
  )

  const flushSave = async(kind: ProplanSaveKind = 'auto'): Promise<boolean> => {
    if (!loaded.value) return false
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    const snapshot = databaseSnapshot(database.value)
    if (kind === 'auto' && snapshot === lastSavedSnapshot.value) return false
    saving.value = true
    saveError.value = ''
    try {
      await window.proplan.save(cloneDatabase(database.value))
      lastSavedSnapshot.value = snapshot
      refreshSavedRecordTimes()
      lastSavedAt.value = new Date()
      lastSaveKind.value = kind
      return true
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
      flushSave('auto').catch(() => undefined)
    }, Math.max(1000, preferences.autoSaveDelay))
  }

  const touchProject = (project: ProplanProject): void => {
    project.updatedAt = now()
    scheduleSave()
  }

  const initialize = async(): Promise<void> => {
    if (loaded.value) return
    database.value = await window.proplan.load()
    database.value.projects.forEach(sortTimeline)
    lastSavedSnapshot.value = databaseSnapshot(database.value)
    refreshSavedRecordTimes()
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
    database.value.projects.forEach(sortTimeline)
    lastSavedSnapshot.value = databaseSnapshot(database.value)
    refreshSavedRecordTimes()
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
    const record = availableRecords.find((item) => item.id === recordId)
    selectedRecordId.value = record?.id ?? null
    if (record) showRecordSavedTime(record.id)
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
      name: systemTextForLocale(preferences.language, 'untitledProject'),
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
    const changed = Object.entries(patch).some(
      ([key, value]) => project[key as keyof typeof patch] !== value
    )
    if (!changed) return
    Object.assign(project, patch)
    touchProject(project)
  }

  const deleteProject = (projectId: string): void => {
    const index = projects.value.findIndex((project) => project.id === projectId)
    if (index < 0) return
    const [removed] = database.value.projects.splice(index, 1)
    if (removed) {
      const removedTaskIds = new Set(removed.tasks.map((task) => task.id))
      database.value.globalTaskOrder = database.value.globalTaskOrder.filter(
        (taskId) => !removedTaskIds.has(taskId)
      )
    }
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
        title: systemTextForLocale(preferences.language, 'defaultTaskTitle'),
        completed: false,
        dueAt: null,
        completedAt: null
      }
      project.tasks.unshift(record)
      database.value.globalTaskOrder.unshift(record.id)
    } else if (section === 'timeline') {
      record = {
        ...base,
        title: systemTextForLocale(preferences.language, 'defaultTimelineTitle'),
        occurredAt: timestamp
      }
      project.timeline.unshift(record)
      sortTimeline(project)
    } else {
      record = { ...base, title: systemTextForLocale(preferences.language, 'defaultMemoTitle') }
      project.memos.unshift(record)
    }
    view.value = section
    selectedRecordId.value = record.id
    showRecordSavedTime(record.id, new Date(timestamp))
    touchProject(project)
    return record
  }

  const updateSelectedRecord = (
    patch: Partial<ProplanMemo & ProplanTask & ProplanTimelineEntry>
  ): void => {
    const record = selectedRecord.value
    const project = selectedRecordProject.value
    if (!record || !project) return
    const recordValues = record as unknown as Readonly<Record<string, unknown>>
    const changed = Object.entries(patch).some(
      ([key, value]) => recordValues[key] !== value
    )
    if (!changed) return
    Object.assign(record, patch, { updatedAt: now() })
    if (isTimelineRecord(record)) sortTimeline(project)
    touchProject(project)
  }

  const isTimelineRecord = (record: ProplanRecord): record is ProplanTimelineEntry =>
    'occurredAt' in record

  const reorderProjects = (sourceId: string, targetId: string): void => {
    moveBefore(
      database.value.projects,
      database.value.projects.findIndex((project) => project.id === sourceId),
      database.value.projects.findIndex((project) => project.id === targetId)
    )
    scheduleSave()
  }

  const reorderRecords = (sourceId: string, targetId: string): void => {
    const project = selectedProject.value
    if (!project || (view.value !== 'memos' && view.value !== 'tasks')) return
    const list = project[view.value]
    moveBefore(
      list,
      list.findIndex((record) => record.id === sourceId),
      list.findIndex((record) => record.id === targetId)
    )
    touchProject(project)
  }

  const reorderGlobalTasks = (sourceId: string, targetId: string): void => {
    const visibleIds = records.value.map((record) => record.id)
    const sourceVisibleIndex = visibleIds.indexOf(sourceId)
    const targetVisibleIndex = visibleIds.indexOf(targetId)
    if (sourceVisibleIndex < 0 || targetVisibleIndex < 0 || sourceVisibleIndex === targetVisibleIndex) {
      return
    }
    const visiblePositions = database.value.globalTaskOrder
      .map((id, index) => (visibleIds.includes(id) ? index : -1))
      .filter((index) => index >= 0)
    const reorderedVisible = [...visibleIds]
    moveBefore(reorderedVisible, sourceVisibleIndex, targetVisibleIndex)
    visiblePositions.forEach((position, index) => {
      const taskId = reorderedVisible[index]
      if (taskId) database.value.globalTaskOrder[position] = taskId
    })
    scheduleSave()
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
        if (section === 'tasks') {
          database.value.globalTaskOrder = database.value.globalTaskOrder.filter(
            (taskId) => taskId !== recordId
          )
        }
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
    lastSavedAt,
    lastSaveKind,
    hasUnsavedChanges,
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
    reorderProjects,
    reorderRecords,
    reorderGlobalTasks,
    toggleTask,
    deleteRecord,
    deleteSelectedRecord,
    flushSave
  }
})
