<template>
  <section class="task-calendar">
    <header class="calendar-header drag-region">
      <div class="calendar-heading no-drag">
        <h2>{{ monthTitle }}</h2>
        <span class="calendar-summary">
          {{ systemText('monthItems', { count: monthItemCount }) }}
          <template v-if="unscheduledItemCount"> · {{ systemText('unscheduledItems', { count: unscheduledItemCount }) }}</template>
        </span>
      </div>

      <div class="calendar-actions no-drag">
        <button
          class="today-button"
          @click="goToToday"
        >
          {{ systemText('today') }}
        </button>
        <button
          class="calendar-icon-button"
          :title="systemText('previousMonth')"
          :aria-label="systemText('previousMonth')"
          @click="changeMonth(-1)"
        >
          <ArrowLeft />
        </button>
        <button
          class="calendar-icon-button"
          :title="systemText('nextMonth')"
          :aria-label="systemText('nextMonth')"
          @click="changeMonth(1)"
        >
          <ArrowRight />
        </button>
      </div>
    </header>

    <div class="weekday-row">
      <span
        v-for="weekday in weekdays"
        :key="weekday"
      >{{ weekday }}</span>
    </div>

    <div class="calendar-grid">
      <div
        v-for="day in visibleDays"
        :key="day.key"
        class="calendar-day"
        :class="{ outside: !day.inCurrentMonth, today: day.isToday }"
      >
        <div class="day-heading">
          <span class="day-number">{{ day.dayNumber }}</span>
          <span
            v-if="day.isToday"
            class="today-label"
          >{{ systemText('today') }}</span>
        </div>

        <div class="day-tasks">
          <button
            v-for="item in itemsByDate.get(day.key) ?? []"
            :key="item.id"
            class="calendar-task"
            :class="{ completed: item.completed }"
            :title="`${item.context} · ${item.title}`"
            @click="emit('selectItem', item.id, item.kind)"
          >
            <span
              class="task-project-mark"
              :style="{ background: item.color }"
            />
            <span
              v-if="item.priority"
              class="task-priority-dot"
              :style="{ background: priorityColor(item.priority) }"
              aria-hidden="true"
            />
            <span class="task-title">
              <span class="task-context">{{ item.context }}</span>
              {{ item.title }}
            </span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import {
  PROPLAN_TASK_PRIORITY_COLORS,
  type ProplanCalendarItem,
  type ProplanSection,
  type ProplanTaskPriority
} from '@shared/types/proplan'
import {
  formatLocaleDate,
  systemTextForLocale,
  type SystemTextKey,
  type SystemTextParams
} from '@/util/systemLocale'

const props = defineProps<{
  items: ProplanCalendarItem[]
  todayKey: string
  locale: string
}>()

const systemText = (key: SystemTextKey, params: SystemTextParams = {}): string =>
  systemTextForLocale(props.locale, key, params)
const formatSystemDate = (date: Date, options: Intl.DateTimeFormatOptions): string =>
  formatLocaleDate(props.locale, date, options)
const priorityColor = (priority: ProplanTaskPriority): string =>
  PROPLAN_TASK_PRIORITY_COLORS[priority]

const emit = defineEmits<{
  selectItem: [itemId: string, kind: ProplanSection]
}>()

const weekdays = computed(() =>
  Array.from({ length: 7 }, (_, index) =>
    formatSystemDate(new Date(2024, 0, 1 + index), { weekday: 'short' })
  )
)
const today = new Date()
const visibleMonth = ref(new Date(today.getFullYear(), today.getMonth(), 1))

const dateKey = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const visibleMonthKey = computed(() => dateKey(visibleMonth.value).slice(0, 7))
const monthTitle = computed(() =>
  formatSystemDate(visibleMonth.value, { year: 'numeric', month: 'long' })
)
const monthItemCount = computed(
  () => props.items.filter((item) => item.date?.startsWith(visibleMonthKey.value)).length
)
const unscheduledItemCount = computed(() => props.items.filter((item) => !item.date).length)
const itemsByDate = computed(() => {
  const result = new Map<string, ProplanCalendarItem[]>()
  for (const item of props.items) {
    if (!item.date) continue
    const entries = result.get(item.date) ?? []
    entries.push(item)
    result.set(item.date, entries)
  }
  return result
})

const visibleDays = computed(() => {
  const year = visibleMonth.value.getFullYear()
  const month = visibleMonth.value.getMonth()
  const firstWeekday = new Date(year, month, 1).getDay()
  const mondayOffset = firstWeekday === 0 ? 6 : firstWeekday - 1
  const firstVisibleDate = new Date(year, month, 1 - mondayOffset)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(
      firstVisibleDate.getFullYear(),
      firstVisibleDate.getMonth(),
      firstVisibleDate.getDate() + index
    )
    const key = dateKey(date)
    return {
      key,
      dayNumber: date.getDate(),
      inCurrentMonth: date.getMonth() === month,
      isToday: key === props.todayKey
    }
  })
})

const changeMonth = (offset: number): void => {
  visibleMonth.value = new Date(
    visibleMonth.value.getFullYear(),
    visibleMonth.value.getMonth() + offset,
    1
  )
}

const goToToday = (): void => {
  const date = new Date()
  visibleMonth.value = new Date(date.getFullYear(), date.getMonth(), 1)
}

watch(
  () => props.todayKey,
  (nextToday, previousToday) => {
    if (visibleMonthKey.value === previousToday.slice(0, 7)) {
      const [year, month] = nextToday.split('-').map(Number)
      if (year && month) visibleMonth.value = new Date(year, month - 1, 1)
    }
  }
)
</script>

<style scoped>
.task-calendar {
  min-width: 0;
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--editorColor80);
  background: var(--editorBgColor);
}

.drag-region {
  -webkit-app-region: drag;
}
.no-drag,
button {
  -webkit-app-region: no-drag;
}

.calendar-header {
  min-height: var(--record-header-height, 92px);
  flex: 0 0 var(--record-header-height, 92px);
  box-sizing: border-box;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  padding: 0 28px calc(var(--header-bottom-padding, 12px) - 1px) 9px;
  border-bottom: 1px solid var(--editorColor10);
}

.calendar-heading {
  min-width: 0;
}
.calendar-heading h2 {
  margin: 0;
  font-size: var(--header-title-size, 20px);
  line-height: var(--header-title-line-height, 29px);
  letter-spacing: 0;
}
.calendar-summary {
  display: block;
  color: var(--editorColor50);
  font-size: var(--header-description-size, 12px);
  line-height: var(--header-description-line-height, 22px);
  white-space: nowrap;
}

.calendar-actions {
  display: flex;
  align-items: center;
  gap: 5px;
}
.calendar-actions button {
  height: 28px;
  border: 1px solid var(--editorColor10);
  border-radius: 5px;
  color: var(--editorColor80);
  background: var(--editorBgColor);
}
.calendar-actions button:hover {
  background: var(--editorColor10);
}
.today-button {
  padding: 0 11px;
  font-size: 11px;
}
.calendar-icon-button {
  width: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
.calendar-icon-button svg {
  width: 14px;
  height: 14px;
}

.weekday-row {
  height: 32px;
  flex: 0 0 32px;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  border-bottom: 1px solid var(--editorColor10);
}
.weekday-row span {
  display: flex;
  align-items: center;
  padding-left: 9px;
  color: var(--editorColor50);
  font-size: 10px;
  font-weight: 650;
}

.calendar-grid {
  min-height: 0;
  flex: 1;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  grid-template-rows: repeat(6, minmax(0, 1fr));
}
.calendar-day {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 6px;
  border-right: 1px solid var(--editorColor10);
  border-bottom: 1px solid var(--editorColor10);
  background: var(--editorBgColor);
}
.calendar-day:nth-child(7n) {
  border-right: 0;
}
.calendar-day:nth-last-child(-n + 7) {
  border-bottom: 0;
}
.calendar-day.outside {
  background: var(--editorColor04);
}
.calendar-day.outside .day-number,
.calendar-day.outside .calendar-task {
  opacity: 0.48;
}

.day-heading {
  height: 23px;
  flex: 0 0 23px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.day-number {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--editorColor60);
  font-size: 11px;
}
.calendar-day.today .day-number {
  color: white;
  background: var(--themeColor);
}
.today-label {
  color: var(--themeColor);
  font-size: 9px;
  line-height: 20px;
}

.day-tasks {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-width: none;
}
.day-tasks::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}
.calendar-task {
  width: 100%;
  height: 22px;
  flex: 0 0 22px;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0 5px;
  border: 0;
  border-radius: 4px;
  color: var(--editorColor80);
  text-align: left;
  background: var(--editorColor04);
}
.calendar-task:hover {
  background: var(--themeColor10);
}
.calendar-task.completed {
  color: var(--editorColor40);
}
.calendar-task.completed .task-title {
  text-decoration: line-through;
}
.task-project-mark {
  width: 3px;
  height: 12px;
  flex: 0 0 3px;
  border-radius: 2px;
}
.task-priority-dot {
  width: 6px;
  height: 6px;
  flex: 0 0 6px;
  border-radius: 50%;
}
.task-title {
  min-width: 0;
  overflow: hidden;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.task-context {
  color: var(--editorColor50);
}

@media (max-width: 1040px) {
  .calendar-header {
    padding-right: 18px;
  }
  .calendar-summary {
    display: block;
    margin: 2px 0 0;
  }
  .calendar-day {
    padding: 4px;
  }
  .today-label {
    display: none;
  }
}
</style>
