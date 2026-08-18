<template>
  <div
    class="proplan-workspace"
    @click="closeRecordContextMenu"
  >
    <aside
      class="project-pane"
      :style="{ width: `${projectWidth}px` }"
    >
      <header class="project-titlebar drag-region">
        <div class="project-heading">
          <strong>Proplan</strong>
          <span class="pane-label">{{ systemText('projects') }}</span>
        </div>
        <button
          class="icon-button no-drag"
          :title="systemText('newProject')"
          @click="createProject"
        >
          <Plus />
        </button>
      </header>
      <div class="project-list">
        <TransitionGroup name="list-reorder">
          <button
            v-for="project in projects"
            :key="project.id"
            class="project-row"
            :class="{
              active: project.id === selectedProjectId && view !== 'globalTasks',
              dragging: draggedProjectId === project.id
            }"
            draggable="true"
            @click="store.selectProject(project.id)"
            @contextmenu.prevent.stop="openProjectContextMenu(project.id, project.name, $event)"
            @dragstart="startProjectDrag(project.id, $event)"
            @dragover.prevent
            @dragenter.prevent="previewProjectOrder(project.id)"
            @drop.prevent="endDrag"
            @dragend="endDrag"
          >
            <span
              class="project-mark"
              :style="{ background: project.color }"
            />
            <span class="project-row-copy">
              <span class="row-title">{{ project.name }}</span>
              <span class="row-meta">{{ systemText('openTaskCount', { count: project.tasks.filter((task) => !task.completed).length }) }}</span>
            </span>
          </button>
        </TransitionGroup>
        <button
          v-if="projects.length === 0"
          class="empty-project-button"
          @click="createProject"
        >
          <Plus />
          {{ systemText('createFirstProject') }}
        </button>
      </div>

      <nav class="project-footer">
        <button
          :class="{ active: view === 'globalTasks' }"
          @click="store.setView('globalTasks')"
        >
          <Finished />
          <span>{{ systemText('myTasks') }}</span>
          <span class="nav-count">{{ openTaskCount }}</span>
        </button>
      </nav>
    </aside>

    <div
      class="pane-resizer"
      :title="systemText('resizeProjects')"
      @pointerdown="startResize('project', $event)"
      @dblclick="projectWidth = PROJECT_MIN"
    />

    <aside
      class="record-pane"
      :style="{ width: `${recordWidth}px` }"
    >
      <header class="record-header drag-region">
        <template v-if="view === 'globalTasks'">
          <div class="record-heading">
            <h2>{{ systemText('myTasks') }}</h2>
            <span class="header-eyebrow">{{ systemText('overview') }}</span>
          </div>
        </template>
        <template v-else-if="selectedProject">
          <input
            class="project-name-input no-drag"
            :value="selectedProject.name"
            :aria-label="systemText('projectName')"
            @input="updateProjectName"
          >
          <input
            class="project-description-input no-drag"
            :value="selectedProject.description"
            :aria-label="systemText('projectDescription')"
            :placeholder="systemText('addProjectDescription')"
            @input="updateProjectDescription"
          >
        </template>
        <template v-else>
          <div class="record-heading">
            <h2>{{ systemText('projects') }}</h2>
            <span class="header-eyebrow">{{ systemText('workspace') }}</span>
          </div>
        </template>
      </header>

      <div
        v-if="view !== 'globalTasks' && selectedProject"
        class="section-tabs"
      >
        <button
          :class="{ active: view === 'memos' }"
          @click="store.setView('memos')"
        >
          {{ systemText('memos') }}
        </button>
        <button
          :class="{ active: view === 'tasks' }"
          @click="store.setView('tasks')"
        >
          {{ systemText('tasks') }}
        </button>
        <button
          :class="{ active: view === 'timeline' }"
          @click="store.setView('timeline')"
        >
          {{ systemText('timelineLabel') }}
        </button>
      </div>

      <div
        v-else-if="view === 'globalTasks'"
        class="section-tabs task-filter-tabs"
      >
        <button
          :class="{ active: globalTaskFilter === 'all' }"
          @click="store.setGlobalTaskFilter('all')"
        >
          {{ systemText('allTasks') }}
        </button>
        <button
          :class="{ active: globalTaskFilter === 'today' }"
          @click="store.setGlobalTaskFilter('today')"
        >
          {{ systemText('todayTasks') }}
        </button>
      </div>

      <div class="record-toolbar">
        <span>{{ recordCountLabel }}</span>
        <button
          v-if="selectedProject && view !== 'globalTasks'"
          class="icon-button"
          :title="newRecordLabel"
          @click="store.createRecord()"
        >
          <Plus />
        </button>
      </div>

      <div
        class="record-list"
        :class="{ 'timeline-list': view === 'timeline' }"
      >
        <TransitionGroup name="list-reorder">
          <button
            v-for="record in records"
            :key="record.id"
            class="record-row"
            :class="{ active: record.id === selectedRecordId, dragging: draggedRecordId === record.id }"
            :draggable="canReorderRecords"
            @click="store.selectRecord(record.id)"
            @contextmenu.prevent.stop="openRecordContextMenu(record, $event)"
            @dragstart="startRecordDrag(record.id, $event)"
            @dragover="allowRecordDrop"
            @dragenter="previewRecordOrder(record.id, $event)"
            @drop.prevent="endDrag"
            @dragend="endDrag"
          >
            <span
              v-if="view === 'timeline'"
              class="timeline-marker"
              aria-hidden="true"
            >
              <span class="timeline-node" />
            </span>
            <span
              v-else-if="isTask(record)"
              class="task-check"
              :class="{ checked: record.completed }"
              @click.stop="store.toggleTask(record.id)"
            >
              <Check v-if="record.completed" />
            </span>
            <span
              v-else
              class="record-icon"
            >
              <Edit />
            </span>
            <span class="record-copy">
              <span
                class="row-title"
                :class="{ completed: isTask(record) && record.completed }"
              >{{
                record.title
              }}</span>
              <span class="row-meta">
                <template v-if="view === 'globalTasks'">{{ taskProjectName(record.id) }} · </template>{{ recordMeta(record) }}
              </span>
            </span>
          </button>
        </TransitionGroup>

        <div
          v-if="records.length === 0"
          class="empty-records"
        >
          <component :is="view === 'globalTasks' || view === 'tasks' ? Finished : Edit" />
          <span>{{ emptyRecordLabel }}</span>
        </div>
      </div>
    </aside>

    <div
      class="pane-resizer"
      :title="systemText('resizeRecords')"
      @pointerdown="startResize('record', $event)"
      @dblclick="recordWidth = RECORD_MIN"
    />

    <main class="detail-pane">
      <template v-if="selectedRecord">
        <header class="detail-header drag-region">
          <button
            class="detail-close-button no-drag"
            :title="systemText('closeEditor')"
            :aria-label="systemText('closeEditor')"
            @click="store.clearSelectedRecord()"
          >
            <Close />
          </button>
          <div class="detail-header-inner no-drag">
            <input
              class="record-title-input"
              :value="selectedRecord.title"
              :aria-label="systemText('title')"
              @input="updateRecordTitle"
            >
          </div>

          <div
            v-if="isTask(selectedRecord) || isTimeline(selectedRecord)"
            class="record-properties no-drag"
          >
            <label
              v-if="isTask(selectedRecord)"
              class="due-date-control"
              :class="{ empty: !selectedRecord.dueAt }"
              :title="systemText('setDueDate')"
              @click.prevent="openDueDatePicker"
            >
              <Calendar aria-hidden="true" />
              <span
                class="due-date-label"
                aria-hidden="true"
              >{{ dueDateLabel }}</span>
              <input
                ref="dueDateInput"
                class="due-date-input"
                type="date"
                :lang="language"
                :value="selectedRecord.dueAt ?? ''"
                :aria-label="systemText('dueDate')"
                @change="updateDueDate"
              >
            </label>
            <label
              v-else
              class="due-date-control"
              :class="{ empty: !selectedRecord.occurredAt }"
              :title="systemText('setDateTime')"
              @click.prevent="openRecordDatePicker"
            >
              <Calendar aria-hidden="true" />
              <span
                class="due-date-label"
                aria-hidden="true"
              >{{ timelineDateLabel }}</span>
              <input
                ref="recordDateInput"
                class="due-date-input"
                type="datetime-local"
                :lang="language"
                :value="dateTimeLocalValue(selectedRecord.occurredAt)"
                :aria-label="systemText('dateTime')"
                @change="updateTimelineDate"
              >
            </label>
            <span
              v-if="view === 'globalTasks'"
              class="project-chip"
              :style="{ '--chip-color': selectedRecordProject?.color }"
            >{{ selectedRecordProject?.name }}</span>
          </div>
        </header>

        <div class="markdown-area">
          <ProplanMarkdownEditor
            :record-id="selectedRecord.id"
            :model-value="selectedRecord.markdown"
            @update:model-value="updateMarkdown"
          />
        </div>
        <span class="save-status">{{ saveStatus }}</span>
      </template>

      <ProplanTaskCalendar
        v-else-if="view === 'globalTasks'"
        :items="globalCalendarItems"
        :today-key="currentDateKey"
        :locale="language"
        @select-item="openGlobalCalendarItem"
      />

      <ProplanTaskCalendar
        v-else-if="selectedProject"
        :items="projectCalendarItems"
        :today-key="currentDateKey"
        :locale="language"
        @select-item="openProjectCalendarItem"
      />

      <div
        v-else
        class="detail-empty"
      >
        <FolderOpened v-if="!selectedProject" />
        <Finished v-else />
        <h2>{{ detailEmptyTitle }}</h2>
        <button
          v-if="!selectedProject"
          class="primary-button"
          @click="createProject"
        >
          <Plus />
          {{ systemText('newProject') }}
        </button>
      </div>
    </main>

    <div
      v-if="recordContextMenu"
      class="record-context-menu"
      role="menu"
      :style="{ left: `${recordContextMenu.x}px`, top: `${recordContextMenu.y}px` }"
      @click.stop
      @contextmenu.prevent
    >
      <button
        role="menuitem"
        @click="removeContextTarget"
      >
        <Delete />
        {{ systemText('delete') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import {
  Calendar,
  Check,
  Close,
  Delete,
  Edit,
  Finished,
  FolderOpened,
  Plus
} from '@element-plus/icons-vue'
import type {
  ProplanCalendarItem,
  ProplanSection,
  ProplanTask,
  ProplanTimelineEntry
} from '@shared/types/proplan'
import { useProplanStore, type ProplanRecord } from '@/store/proplan'
import { usePreferencesStore } from '@/store/preferences'
import notice from '@/services/notification'
import {
  formatLocaleDate,
  systemTextForLocale,
  type SystemTextKey,
  type SystemTextParams
} from '@/util/systemLocale'
import ProplanMarkdownEditor from './ProplanMarkdownEditor.vue'
import ProplanTaskCalendar from './ProplanTaskCalendar.vue'

const PROJECT_MIN = 196
const RECORD_MIN = 260
const store = useProplanStore()
const preferencesStore = usePreferencesStore()
const { autoSave, language } = storeToRefs(preferencesStore)
const systemText = (key: SystemTextKey, params: SystemTextParams = {}): string =>
  systemTextForLocale(language.value, key, params)
const formatSystemDate = (date: Date, options: Intl.DateTimeFormatOptions): string =>
  formatLocaleDate(language.value, date, options)
const {
  projects,
  records,
  globalTasks,
  globalTaskFilter,
  selectedProject,
  selectedProjectId,
  selectedRecord,
  selectedRecordId,
  selectedRecordProject,
  saving,
  saveError,
  lastSavedAt,
  lastSaveKind,
  hasUnsavedChanges,
  currentDateKey,
  view
} = storeToRefs(store)
const projectWidth = ref(PROJECT_MIN)
const recordWidth = ref(RECORD_MIN)
const dueDateInput = ref<HTMLInputElement | null>(null)
const recordDateInput = ref<HTMLInputElement | null>(null)
const draggedProjectId = ref<string | null>(null)
const draggedRecordId = ref<string | null>(null)
const projectDragTargetId = ref<string | null>(null)
const recordDragTargetId = ref<string | null>(null)
const recordContextMenu = ref<{
  kind: 'project' | 'record'
  id: string
  title: string
  x: number
  y: number
} | null>(null)

const openTaskCount = computed(() => globalTasks.value.length)
const globalCalendarItems = computed<ProplanCalendarItem[]>(() =>
  globalTasks.value.map(({ projectName, projectColor, task }) => ({
    id: task.id,
    title: task.title,
    date: task.dueAt,
    color: projectColor,
    context: projectName,
    kind: 'tasks'
  }))
)
const projectCalendarItems = computed<ProplanCalendarItem[]>(() => {
  const project = selectedProject.value
  if (!project) return []
  return [
    ...project.memos.map((memo) => ({
      id: memo.id,
      title: memo.title,
      date: memo.createdAt.slice(0, 10),
      color: project.color,
      context: systemText('memo'),
      kind: 'memos' as const
    })),
    ...project.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      date: task.dueAt,
      color: project.color,
      context: systemText('task'),
      kind: 'tasks' as const,
      completed: task.completed
    })),
    ...project.timeline.map((entry) => ({
      id: entry.id,
      title: entry.title,
      date: entry.occurredAt.slice(0, 10),
      color: project.color,
      context: systemText('timeline'),
      kind: 'timeline' as const
    }))
  ]
})
const recordCountLabel = computed(() => systemText('itemCount', { count: records.value.length }))
const newRecordLabel = computed(() => {
  if (view.value === 'tasks' || view.value === 'globalTasks') return systemText('newTask')
  if (view.value === 'timeline') return systemText('newTimelineEntry')
  return systemText('newMemo')
})
const emptyRecordLabel = computed(() => {
  if (view.value === 'globalTasks') {
    return globalTaskFilter.value === 'today' ? systemText('noTodayTasks') : systemText('noTasks')
  }
  if (view.value === 'tasks') return systemText('noTasks')
  if (view.value === 'timeline') return systemText('noTimelineEntries')
  return systemText('noMemos')
})
const detailEmptyTitle = computed(() => {
  if (!selectedProject.value && view.value !== 'globalTasks') return systemText('startWithProject')
  if (view.value === 'globalTasks') return systemText('noTasksToDisplay')
  return emptyRecordLabel.value
})
const saveStatus = computed(() => {
  if (saveError.value) return systemText('saveFailed')
  if (saving.value) return systemText('saving')
  if (hasUnsavedChanges.value) {
    return autoSave.value ? systemText('waitingAutoSave') : systemText('unsavedChanges')
  }
  if (lastSavedAt.value) {
    const date = lastSavedAt.value
    const time = formatSystemDate(date, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
    if (lastSaveKind.value) {
      return `${systemText(lastSaveKind.value === 'manual' ? 'manualSaveSucceeded' : 'autoSaveSucceeded')} ${time}`
    }
    return `${systemText('lastSaved')} ${time}`
  }
  if (!autoSave.value) return systemText('saveOnExit')
  return systemText('noUnsavedChanges')
})
const canReorderRecords = computed(
  () => view.value === 'memos' || view.value === 'tasks' || view.value === 'globalTasks'
)
const dueDateLabel = computed(() => {
  const record = selectedRecord.value
  if (!record || !isTask(record) || !record.dueAt) return systemText('dueDate')
  const [year, month, day] = record.dueAt.split('-').map(Number)
  if (!year || !month || !day) return record.dueAt
  return formatSystemDate(new Date(year, month - 1, day), {
    ...(year === new Date().getFullYear() ? {} : { year: 'numeric' }),
    month: 'short',
    day: 'numeric'
  })
})
const timelineDateLabel = computed(() => {
  const record = selectedRecord.value
  if (!record || !isTimeline(record) || !record.occurredAt) return systemText('dateTime')
  return formatDateTime(record.occurredAt)
})

const isTask = (record: ProplanRecord): record is ProplanTask => 'completed' in record
const isTimeline = (record: ProplanRecord): record is ProplanTimelineEntry => 'occurredAt' in record

const createProject = (): void => {
  store.createProject()
  requestAnimationFrame(() => {
    const input = document.querySelector<HTMLInputElement>('.project-name-input')
    input?.focus()
    input?.select()
  })
}

const closeRecordContextMenu = (): void => {
  recordContextMenu.value = null
}

const contextMenuPosition = (event: MouseEvent): { x: number; y: number } => {
  const menuWidth = 132
  const menuHeight = 42
  return {
    x: Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8)),
    y: Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8))
  }
}

const openProjectContextMenu = (id: string, title: string, event: MouseEvent): void => {
  recordContextMenu.value = { kind: 'project', id, title, ...contextMenuPosition(event) }
}

const openRecordContextMenu = (record: ProplanRecord, event: MouseEvent): void => {
  recordContextMenu.value = {
    kind: 'record',
    id: record.id,
    title: record.title,
    ...contextMenuPosition(event)
  }
}

const removeContextTarget = (): void => {
  const target = recordContextMenu.value
  closeRecordContextMenu()
  if (!target) return
  if (target.kind === 'project') {
    if (window.confirm(systemText('deleteProjectConfirm', { title: target.title }))) {
      store.deleteProject(target.id)
    }
  } else if (window.confirm(systemText('deleteRecordConfirm', { title: target.title }))) {
    store.deleteRecord(target.id)
  }
}

const handleContextMenuKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') closeRecordContextMenu()
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    performManualSave().catch(() => undefined)
  }
}

const performManualSave = async (): Promise<void> => {
  try {
    await store.flushSave('manual')
  } catch (error) {
    await notice.notify({
      title: systemText('saveFailed'),
      message: error instanceof Error ? error.message : String(error),
      type: 'error'
    })
    throw error
  }
}

const eventValue = (event: Event): string => (event.target as HTMLInputElement).value

const startProjectDrag = (projectId: string, event: DragEvent): void => {
  draggedProjectId.value = projectId
  projectDragTargetId.value = null
  event.dataTransfer?.setData('text/plain', projectId)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}
const previewProjectOrder = (targetId: string): void => {
  const sourceId = draggedProjectId.value
  if (!sourceId || sourceId === targetId || projectDragTargetId.value === targetId) return
  projectDragTargetId.value = targetId
  store.reorderProjects(sourceId, targetId)
}
const startRecordDrag = (recordId: string, event: DragEvent): void => {
  if (!canReorderRecords.value) {
    event.preventDefault()
    return
  }
  draggedRecordId.value = recordId
  recordDragTargetId.value = null
  event.dataTransfer?.setData('text/plain', recordId)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}
const allowRecordDrop = (event: DragEvent): void => {
  if (canReorderRecords.value) event.preventDefault()
}
const previewRecordOrder = (targetId: string, event: DragEvent): void => {
  if (!canReorderRecords.value) return
  event.preventDefault()
  const sourceId = draggedRecordId.value
  if (!sourceId || sourceId === targetId || recordDragTargetId.value === targetId) return
  recordDragTargetId.value = targetId
  if (view.value === 'globalTasks') store.reorderGlobalTasks(sourceId, targetId)
  else store.reorderRecords(sourceId, targetId)
}
const endDrag = (): void => {
  draggedProjectId.value = null
  draggedRecordId.value = null
  projectDragTargetId.value = null
  recordDragTargetId.value = null
}

const updateProjectName = (event: Event): void => {
  if (selectedProject.value) { store.updateProject(selectedProject.value.id, { name: eventValue(event) }) }
}
const updateProjectDescription = (event: Event): void => {
  if (selectedProject.value) {
    store.updateProject(selectedProject.value.id, { description: eventValue(event) })
  }
}
const updateRecordTitle = (event: Event): void =>
  store.updateSelectedRecord({ title: eventValue(event) })
const updateMarkdown = (markdown: string): void => store.updateSelectedRecord({ markdown })
const openDueDatePicker = (): void => {
  const input = dueDateInput.value
  if (!input) return
  input.focus({ preventScroll: true })
  input.showPicker()
}
const updateDueDate = (event: Event): void =>
  store.updateSelectedRecord({ dueAt: eventValue(event) || null })
const openRecordDatePicker = (): void => {
  const input = recordDateInput.value
  if (!input) return
  input.focus({ preventScroll: true })
  input.showPicker()
}
const updateTimelineDate = (event: Event): void => {
  const value = eventValue(event)
  if (value) store.updateSelectedRecord({ occurredAt: value })
}

const dateTimeLocalValue = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 16)
  const part = (number: number): string => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}T${part(date.getHours())}:${part(date.getMinutes())}`
}

const formatDateTime = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.replace('T', ' ')
  return formatSystemDate(date, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

const taskProjectName = (taskId: string): string =>
  globalTasks.value.find(({ task }) => task.id === taskId)?.projectName ?? ''

const openGlobalCalendarItem = (taskId: string): void => {
  store.setGlobalTaskFilter('all')
  store.selectRecord(taskId)
}

const openProjectCalendarItem = (recordId: string, section: ProplanSection): void => {
  store.setView(section)
  store.selectRecord(recordId)
}

const recordMeta = (record: ProplanRecord): string => {
  if (isTask(record)) {
    return record.dueAt
      ? systemText('due', { date: record.dueAt })
      : systemText('noDueDate')
  }
  if (isTimeline(record)) return formatDateTime(record.occurredAt)
  return formatSystemDate(new Date(record.updatedAt), { month: 'short', day: 'numeric' })
}

type ResizePane = 'project' | 'record'
const startResize = (pane: ResizePane, event: PointerEvent): void => {
  event.preventDefault()
  const startX = event.clientX
  const initial = pane === 'project' ? projectWidth.value : recordWidth.value
  const min = pane === 'project' ? PROJECT_MIN : RECORD_MIN
  const max = pane === 'project' ? 380 : 460
  document.body.classList.add('proplan-resizing')
  const move = (moveEvent: PointerEvent): void => {
    const next = Math.min(max, Math.max(min, initial + moveEvent.clientX - startX))
    if (pane === 'project') projectWidth.value = next
    else recordWidth.value = next
  }
  const stop = (): void => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', stop)
    document.body.classList.remove('proplan-resizing')
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', stop, { once: true })
}

let removeCloseListener: (() => void) | null = null
let dateRefreshTimer: ReturnType<typeof setInterval> | null = null
let closing = false

const closeAfterSave = async (): Promise<void> => {
  if (closing) return
  closing = true
  try {
    await store.flushSave()
    window.electron.ipcRenderer.send('mt::close-window')
  } catch (error) {
    closing = false
    await notice.notify({
      title: systemText('cannotClose'),
      message: systemText('saveFailedWindowOpen', {
        error: error instanceof Error ? error.message : String(error)
      }),
      type: 'error',
      time: 15000
    })
  }
}

onMounted(() => {
  removeCloseListener = window.electron.ipcRenderer.on('mt::ask-for-close', () => {
    closeAfterSave().catch((error) => console.error('关闭 Proplan 失败', error))
  })
  store.refreshCurrentDate()
  dateRefreshTimer = setInterval(() => store.refreshCurrentDate(), 60_000)
  window.addEventListener('blur', closeRecordContextMenu)
  window.addEventListener('resize', closeRecordContextMenu)
  document.addEventListener('keydown', handleContextMenuKeydown)
  store.initialize().catch((error) => {
    notice
      .notify({
        title: systemText('cannotReadData'),
        message: error instanceof Error ? error.message : String(error),
        type: 'error',
        time: 20000
      })
      .catch(() => undefined)
    console.error('初始化 Proplan 失败', error)
  })
})
onBeforeUnmount(() => {
  removeCloseListener?.()
  if (dateRefreshTimer) clearInterval(dateRefreshTimer)
  window.removeEventListener('blur', closeRecordContextMenu)
  window.removeEventListener('resize', closeRecordContextMenu)
  document.removeEventListener('keydown', handleContextMenuKeydown)
  store.flushSave().catch((error) => console.error('保存 Proplan 失败', error))
})
</script>

<style scoped>
.proplan-workspace {
  --panel-border: var(--editorColor10);
  --muted: var(--editorColor50);
  --text: var(--editorColor80);
  --accent: var(--themeColor);
  --record-header-height: 92px;
  --header-title-size: 20px;
  --header-title-line-height: 29px;
  --header-description-size: 12px;
  --header-description-line-height: 22px;
  --header-bottom-padding: 12px;
  display: flex;
  position: absolute;
  inset: 0;
  min-width: 760px;
  min-height: 520px;
  overflow: hidden;
  color: var(--text);
  background: var(--editorBgColor);
  letter-spacing: 0;
}

.drag-region {
  -webkit-app-region: drag;
}
.no-drag,
button,
input,
select {
  -webkit-app-region: no-drag;
}

button,
input,
select {
  box-sizing: border-box;
  font: inherit;
  letter-spacing: 0;
}

button {
  color: inherit;
}

.project-pane,
.record-pane {
  flex: 0 0 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.project-pane {
  background: var(--sideBarBgColor);
}
.record-pane {
  background: color-mix(in srgb, var(--editorBgColor) 96%, var(--editorColor) 4%);
}

.project-titlebar {
  height: var(--record-header-height);
  flex: 0 0 var(--record-header-height);
  box-sizing: border-box;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 0 15px var(--header-bottom-padding);
}

.project-heading {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.project-titlebar strong {
  font-size: var(--header-title-size);
  font-weight: 680;
  line-height: var(--header-title-line-height);
}
.project-titlebar .icon-button {
  margin-bottom: var(--header-description-line-height);
}
.project-heading .pane-label {
  color: var(--muted);
  font-size: var(--header-description-size);
  font-weight: 400;
  line-height: var(--header-description-line-height);
}

.icon-button {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  cursor: default;
}

.icon-button:hover {
  background: var(--editorColor10);
}
.icon-button svg {
  width: 15px;
  height: 15px;
}

.record-toolbar {
  height: 30px;
  flex: 0 0 30px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 650;
}

.project-list,
.record-list {
  min-height: 0;
  overflow: auto;
  padding: 0 7px 8px;
}

.project-list {
  flex: 1;
}

.project-row,
.record-row {
  width: 100%;
  border: 0;
  display: flex;
  align-items: center;
  text-align: left;
  background: transparent;
  cursor: grab;
}

.project-row {
  min-height: 48px;
  gap: 9px;
  padding: 6px 8px;
  border-radius: 6px;
}

.project-row:hover,
.project-row.active {
  background: var(--editorColor10);
}

.project-row.dragging,
.record-row.dragging {
  opacity: 0.45;
  cursor: grabbing;
}

.record-row[draggable='false'] {
  cursor: default;
}

.list-reorder-move {
  transition: transform 180ms cubic-bezier(0.2, 0, 0, 1);
}

@media (prefers-reduced-motion: reduce) {
  .list-reorder-move {
    transition-duration: 0.01ms;
  }
}

.project-mark {
  width: 9px;
  height: 28px;
  flex: 0 0 9px;
  border-radius: 3px;
}

.project-row-copy,
.record-copy {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.row-title {
  overflow: hidden;
  color: var(--text);
  font-size: 13px;
  font-weight: 570;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-title.completed {
  color: var(--editorColor40);
  text-decoration: line-through;
}

.row-meta {
  overflow: hidden;
  color: var(--muted);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-project-button {
  width: 100%;
  height: 38px;
  display: flex;
  gap: 7px;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--editorColor30);
  border-radius: 6px;
  color: var(--muted);
  background: transparent;
}
.empty-project-button svg {
  width: 14px;
}

.project-footer {
  flex: 0 0 auto;
  padding: 7px;
  border-top: 1px solid var(--panel-border);
}

.project-footer button {
  width: 100%;
  height: 34px;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 0 9px;
  border: 0;
  border-radius: 5px;
  color: var(--sideBarColor);
  font-size: 12px;
  background: transparent;
}

.project-footer button:hover,
.project-footer button.active {
  color: var(--text);
  background: var(--editorColor10);
}
.project-footer svg {
  width: 15px;
}
.nav-count {
  margin-left: auto;
  color: var(--muted);
  font-size: 10px;
}

.pane-resizer {
  width: 1px;
  flex: 0 0 1px;
  position: relative;
  z-index: 5;
  background: var(--panel-border);
  cursor: col-resize;
}
.pane-resizer::after {
  content: '';
  position: absolute;
  inset: 0 -3px;
}
.pane-resizer:hover {
  background: var(--themeColor);
}

.record-header {
  height: var(--record-header-height);
  flex: 0 0 var(--record-header-height);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 0 15px var(--header-bottom-padding);
}
.record-heading {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.record-header h2 {
  margin: 0;
  font-size: var(--header-title-size);
  line-height: var(--header-title-line-height);
}
.header-eyebrow {
  color: var(--muted);
  font-size: var(--header-description-size);
  line-height: var(--header-description-line-height);
}

.project-name-input,
.project-description-input {
  width: 100%;
  padding: 0;
  border: 0;
  color: var(--text);
  background: transparent;
}
.project-name-input {
  height: var(--header-title-line-height);
  font-size: var(--header-title-size);
  font-weight: 680;
  line-height: var(--header-title-line-height);
}
.project-description-input {
  height: var(--header-description-line-height);
  color: var(--muted);
  font-size: var(--header-description-size);
  line-height: var(--header-description-line-height);
}

.section-tabs {
  height: 34px;
  flex: 0 0 34px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
  margin: 0 10px 6px;
  padding: 2px;
  border-radius: 6px;
  background: var(--inputBgColor);
}
.section-tabs button {
  border: 0;
  border-radius: 4px;
  color: var(--muted);
  font-size: 11px;
  background: transparent;
}
.section-tabs button.active {
  color: var(--text);
  background: var(--editorBgColor);
  box-shadow: 0 1px 2px var(--editorColor10);
}
.task-filter-tabs {
  grid-template-columns: repeat(2, 1fr);
}

.record-toolbar {
  justify-content: space-between;
}
.record-list {
  flex: 1;
}
.record-row {
  min-height: 58px;
  gap: 9px;
  padding: 8px 9px;
  border-radius: 6px;
}
.record-row:hover {
  background: var(--editorColor04);
}
.record-row.active {
  background: var(--themeColor10);
}

.record-icon,
.task-check {
  width: 17px;
  height: 17px;
  flex: 0 0 17px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--muted);
}
.record-icon svg {
  width: 15px;
}
.task-check {
  border: 1.5px solid var(--editorColor40);
  border-radius: 50%;
}
.task-check.checked {
  border-color: var(--accent);
  color: white;
  background: var(--accent);
}
.task-check svg {
  width: 11px;
}

.timeline-list .record-row {
  position: relative;
}
.timeline-marker {
  width: 17px;
  align-self: stretch;
  flex: 0 0 17px;
  position: relative;
}
.timeline-marker::before {
  content: '';
  width: 1.5px;
  position: absolute;
  top: -8px;
  bottom: -8px;
  left: 50%;
  background: color-mix(in srgb, var(--themeColor) 34%, var(--editorColor10));
  transform: translateX(-50%);
}
.timeline-list .record-row:first-child .timeline-marker::before {
  top: 50%;
}
.timeline-list .record-row:last-child .timeline-marker::before {
  bottom: 50%;
}
.timeline-node {
  width: 13px;
  height: 13px;
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 1;
  border: 2px solid color-mix(in srgb, var(--themeColor) 45%, var(--editorColor30));
  border-radius: 50%;
  background: var(--editorBgColor);
  transform: translate(-50%, -50%);
}
.timeline-list .record-row.active .timeline-node {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--themeColor) 16%, transparent);
}
.timeline-list .record-row.active .timeline-node::after {
  content: '';
  width: 5px;
  height: 5px;
  position: absolute;
  top: 50%;
  left: 50%;
  border-radius: 50%;
  background: var(--accent);
  transform: translate(-50%, -50%);
}

.empty-records {
  height: 150px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 9px;
  color: var(--editorColor40);
  font-size: 11px;
}
.empty-records svg {
  width: 24px;
}

.record-context-menu {
  width: 124px;
  position: fixed;
  z-index: 30;
  padding: 4px;
  border: 1px solid var(--editorColor10);
  border-radius: 6px;
  background: var(--floatBgColor, var(--editorBgColor));
  box-shadow: 0 8px 24px var(--floatShadow, rgba(0, 0, 0, 0.14));
}
.record-context-menu button {
  width: 100%;
  height: 32px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 9px;
  border: 0;
  border-radius: 4px;
  color: var(--deleteColor);
  font-size: 12px;
  text-align: left;
  background: transparent;
}
.record-context-menu button:hover {
  background: var(--editorColor10);
}
.record-context-menu svg {
  width: 14px;
  height: 14px;
}

.detail-pane {
  min-width: 0;
  min-height: 0;
  flex: 1;
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--editorBgColor, #fff);
}

.detail-header {
  position: relative;
  flex: 0 0 auto;
  padding-top: 46px;
  overflow-y: hidden;
  scrollbar-gutter: stable;
  background: var(--editorBgColor, #fff);
}

.detail-close-button {
  width: 28px;
  height: 28px;
  position: absolute;
  top: 48px;
  right: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 5px;
  color: var(--muted);
  background: transparent;
}
.detail-close-button:hover {
  color: var(--text);
  background: var(--editorColor10);
}
.detail-close-button svg {
  width: 15px;
  height: 15px;
}

.detail-header-inner,
.record-properties {
  box-sizing: border-box;
  width: calc(100% - 64px);
  max-width: var(--proplan-editor-max-width, 820px);
  margin: 0 auto;
}

.detail-header-inner {
  display: flex;
  align-items: center;
}
.record-title-input {
  min-width: 0;
  flex: 1;
  height: 47px;
  padding: 0;
  border: 0;
  color: var(--editorColor80, #292c2e);
  font-size: 28px;
  font-weight: 700;
  background: transparent;
}
.record-properties {
  min-height: 36px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 7px;
  color: var(--muted);
  font-size: 11px;
  border-bottom: 1px solid var(--editorColor10);
}
.record-properties label {
  display: flex;
  align-items: center;
  gap: 6px;
}
.due-date-control {
  width: max-content;
  height: 28px;
  box-sizing: border-box;
  position: relative;
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 5px;
  padding: 0 7px;
  overflow: hidden;
  border: 0;
  border-radius: 5px;
  color: var(--editorColor);
  background: transparent;
  transition: background-color 120ms ease, box-shadow 120ms ease;
}
.due-date-control:hover {
  background: color-mix(in srgb, var(--editorColor10) 55%, transparent);
}
.due-date-control:focus-within {
  box-shadow: 0 0 0 2px var(--themeColor10);
}
.due-date-control.empty {
  color: var(--muted);
}
.due-date-control > svg {
  width: 13px;
  height: 13px;
  flex: 0 0 13px;
  color: var(--muted);
}
.due-date-label {
  overflow: hidden;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
  pointer-events: none;
}
.due-date-input {
  width: 100%;
  height: 100%;
  position: absolute;
  inset: 0;
  margin: 0;
  padding: 0;
  border: 0;
  opacity: 0;
  cursor: default;
  pointer-events: none;
}
.project-chip {
  margin-left: auto;
  padding-left: 9px;
  border-left: 3px solid var(--chip-color, #777);
  color: var(--editorColor);
}

.markdown-area {
  min-height: 0;
  flex: 1;
}
.save-status {
  position: absolute;
  right: 14px;
  bottom: 10px;
  color: var(--editorColor40);
  font-size: 10px;
  pointer-events: none;
}

.detail-empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--editorColor40);
}
.detail-empty > svg {
  width: 36px;
}
.detail-empty h2 {
  margin: 2px 0 8px;
  color: var(--editorColor);
  font-size: 16px;
  font-weight: 600;
}
.primary-button {
  height: 34px;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 13px;
  border: 0;
  border-radius: 5px;
  color: var(--buttonPrimaryFontColor);
  font-size: 12px;
  background: var(--buttonPrimaryBgColor);
}
.primary-button svg {
  width: 14px;
}

:global(body.proplan-resizing) {
  cursor: col-resize !important;
  user-select: none !important;
}
</style>
