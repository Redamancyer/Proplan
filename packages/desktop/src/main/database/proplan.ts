import path from 'path'
import { DatabaseSync } from 'node:sqlite'
import fs from 'fs-extra'
import type {
  ProplanDatabase,
  ProplanMemo,
  ProplanProject,
  ProplanTask,
  ProplanTimelineEntry
} from '@shared/types/proplan'

export const PROPLAN_DATABASE_FILENAME = 'proplan.sqlite'
export const LEGACY_PROPLAN_DATA_FILENAME = 'proplan-data.json'
export const LEGACY_PROPLAN_BACKUP_FILENAME = 'proplan-data.pre-sqlite.json'

type RecordKind = 'memo' | 'task' | 'timeline'

interface ProjectRow {
  id: string
  name: string
  description: string
  color: string
  created_at: string
  updated_at: string
}

interface RecordRow {
  id: string
  project_id: string
  kind: RecordKind
  title: string
  markdown: string
  completed: number
  due_at: string | null
  completed_at: string | null
  priority: ProplanTask['priority']
  occurred_at: string | null
  created_at: string
  updated_at: string
}

const openDatabase = (databasePath: string): DatabaseSync => {
  fs.ensureDirSync(path.dirname(databasePath))
  const database = new DatabaseSync(databasePath)
  database.exec('PRAGMA foreign_keys = ON')
  database.exec('PRAGMA busy_timeout = 5000')
  database.exec(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      position INTEGER NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('memo', 'task', 'timeline')),
      title TEXT NOT NULL,
      markdown TEXT NOT NULL DEFAULT '',
      completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
      due_at TEXT,
      completed_at TEXT,
      priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
      occurred_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      position INTEGER NOT NULL
    ) STRICT;

    CREATE INDEX IF NOT EXISTS records_project_kind_position
      ON records(project_id, kind, position);
    CREATE INDEX IF NOT EXISTS records_open_tasks_due_at
      ON records(kind, completed, due_at);
  `)
  const recordColumns = database.prepare('PRAGMA table_info(records)').all() as Array<{
    name: string
  }>
  if (!recordColumns.some((column) => column.name === 'priority')) {
    database.exec(
      "ALTER TABLE records ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high'))"
    )
  }
  database.exec('PRAGMA user_version = 2')
  return database
}

const withTransaction = (database: DatabaseSync, action: () => void): void => {
  database.exec('BEGIN IMMEDIATE')
  try {
    action()
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
}

export const isProplanDatabaseInitialized = (databasePath: string): boolean => {
  if (!fs.existsSync(databasePath)) return false
  const database = openDatabase(databasePath)
  try {
    const row = database
      .prepare("SELECT value FROM app_meta WHERE key = 'initialized'")
      .get() as { value?: string } | undefined
    return row?.value === '1'
  } finally {
    database.close()
  }
}

export const writeProplanDatabase = (
  databasePath: string,
  value: ProplanDatabase
): void => {
  const database = openDatabase(databasePath)
  try {
    const insertProject = database.prepare(`
      INSERT INTO projects (
        id, name, description, color, created_at, updated_at, position
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    const insertRecord = database.prepare(`
      INSERT INTO records (
        id, project_id, kind, title, markdown, completed, due_at, completed_at,
        occurred_at, priority, created_at, updated_at, position
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    withTransaction(database, () => {
      database.exec('DELETE FROM records; DELETE FROM projects;')
      value.projects.forEach((project, projectPosition) => {
        insertProject.run(
          project.id,
          project.name,
          project.description,
          project.color,
          project.createdAt,
          project.updatedAt,
          projectPosition
        )
        const insertRecords = (
          kind: RecordKind,
          records: Array<ProplanMemo | ProplanTask | ProplanTimelineEntry>
        ): void => {
          records.forEach((record, position) => {
            const task = 'completed' in record ? record : null
            const timeline = 'occurredAt' in record ? record : null
            insertRecord.run(
              record.id,
              project.id,
              kind,
              record.title,
              record.markdown,
              task?.completed ? 1 : 0,
              task?.dueAt ?? null,
              task?.completedAt ?? null,
              timeline?.occurredAt ?? null,
              task?.priority ?? 'medium',
              record.createdAt,
              record.updatedAt,
              position
            )
          })
        }
        insertRecords('memo', project.memos)
        insertRecords('task', project.tasks)
        insertRecords('timeline', project.timeline)
      })
      database
        .prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('initialized', '1')")
        .run()
      database
        .prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('global_task_order', ?)")
        .run(JSON.stringify(value.globalTaskOrder))
    })
  } finally {
    database.close()
  }
}

export const readProplanDatabase = (databasePath: string): ProplanDatabase => {
  const database = openDatabase(databasePath)
  try {
    const projectRows = database
      .prepare('SELECT * FROM projects ORDER BY position')
      .all() as unknown as ProjectRow[]
    const recordRows = database
      .prepare('SELECT * FROM records ORDER BY project_id, kind, position')
      .all() as unknown as RecordRow[]
    const recordsByProject = new Map<string, RecordRow[]>()
    for (const record of recordRows) {
      const records = recordsByProject.get(record.project_id) ?? []
      records.push(record)
      recordsByProject.set(record.project_id, records)
    }

    const projects: ProplanProject[] = projectRows.map((project) => {
      const rows = recordsByProject.get(project.id) ?? []
      const baseRecord = (record: RecordRow): ProplanMemo => ({
        id: record.id,
        title: record.title,
        markdown: record.markdown,
        createdAt: record.created_at,
        updatedAt: record.updated_at
      })
      return {
        id: project.id,
        name: project.name,
        description: project.description,
        color: project.color,
        createdAt: project.created_at,
        updatedAt: project.updated_at,
        memos: rows.filter((record) => record.kind === 'memo').map(baseRecord),
        tasks: rows
          .filter((record) => record.kind === 'task')
          .map((record): ProplanTask => ({
            ...baseRecord(record),
            completed: record.completed === 1,
            dueAt: record.due_at,
            completedAt: record.completed_at,
            priority: record.priority
          })),
        timeline: rows
          .filter((record) => record.kind === 'timeline')
          .map((record): ProplanTimelineEntry => ({
            ...baseRecord(record),
            occurredAt: record.occurred_at ?? record.created_at.slice(0, 10)
          }))
      }
    })
    const orderRow = database
      .prepare("SELECT value FROM app_meta WHERE key = 'global_task_order'")
      .get() as { value?: string } | undefined
    let globalTaskOrder: string[] = []
    try {
      const parsed = JSON.parse(orderRow?.value ?? '[]') as unknown
      if (Array.isArray(parsed)) {
        globalTaskOrder = parsed.filter((id): id is string => typeof id === 'string')
      }
    } catch {
      globalTaskOrder = []
    }
    return { version: 1, projects, globalTaskOrder }
  } finally {
    database.close()
  }
}
