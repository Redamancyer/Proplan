export type ProplanSection = 'memos' | 'tasks' | 'timeline'
export type ProplanTaskPriority = 'low' | 'medium' | 'high'

export const PROPLAN_TASK_PRIORITY_COLORS: Record<ProplanTaskPriority, string> = {
  low: '#3f8f6b',
  medium: '#c58a24',
  high: '#d14f4f'
}

export interface ProplanCalendarItem {
  id: string
  title: string
  date: string | null
  color: string
  context: string
  kind: ProplanSection
  completed?: boolean
  priority?: ProplanTaskPriority
}

export interface ProplanMemo {
  id: string
  title: string
  markdown: string
  createdAt: string
  updatedAt: string
}

export interface ProplanTask extends ProplanMemo {
  completed: boolean
  dueAt: string | null
  completedAt: string | null
  priority: ProplanTaskPriority
}

export interface ProplanTimelineEntry extends ProplanMemo {
  occurredAt: string
}

export interface ProplanProject {
  id: string
  name: string
  description: string
  color: string
  createdAt: string
  updatedAt: string
  memos: ProplanMemo[]
  tasks: ProplanTask[]
  timeline: ProplanTimelineEntry[]
}

export interface ProplanDatabase {
  version: 1
  projects: ProplanProject[]
  globalTaskOrder: string[]
}

export type ProplanImageSource =
  | { kind: 'local'; path?: string }
  | { kind: 'remote'; url: string }
  | { kind: 'data'; dataUrl: string }

export interface ProplanImageImportResult {
  url: string
  filename: string
}

export interface ProplanBackupResult {
  status: 'saved' | 'cancelled'
  filePath?: string
  createdAt?: string
  assetCount?: number
}

export interface ProplanPdfExportRequest {
  title: string
  html: string
}

export interface ProplanPdfExportResult {
  status: 'saved' | 'cancelled'
  filePath?: string
}

export interface ProplanRestoreRequest {
  confirmTitle: string
  confirmMessage: string
  confirmDetail: string
  confirmButton: string
  cancelButton: string
}

export interface ProplanRestoreResult {
  status: 'restored' | 'cancelled'
  createdAt?: string
  assetCount?: number
}

export const createEmptyProplanDatabase = (): ProplanDatabase => ({
  version: 1,
  projects: [],
  globalTaskOrder: []
})
