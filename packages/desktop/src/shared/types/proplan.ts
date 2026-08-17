export type ProplanSection = 'memos' | 'tasks' | 'timeline'

export interface ProplanCalendarItem {
  id: string
  title: string
  date: string | null
  color: string
  context: string
  kind: ProplanSection
  completed?: boolean
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
