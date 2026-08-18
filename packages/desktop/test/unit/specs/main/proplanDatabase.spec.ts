// @vitest-environment node
import os from 'os'
import path from 'path'
import fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProplanDatabase } from '@shared/types/proplan'
import {
  LEGACY_PROPLAN_BACKUP_FILENAME,
  LEGACY_PROPLAN_DATA_FILENAME,
  PROPLAN_DATABASE_FILENAME,
  readProplanDatabase,
  writeProplanDatabase
} from 'main_renderer/database/proplan'

const electronMock = vi.hoisted(() => ({
  userDataPath: '',
  ipcMain: { handle: vi.fn() }
}))

vi.mock('electron', () => ({
  app: { getPath: () => electronMock.userDataPath },
  BrowserWindow: { fromWebContents: vi.fn() },
  dialog: { showOpenDialog: vi.fn() },
  ipcMain: electronMock.ipcMain,
  net: { fetch: vi.fn() }
}))

import { loadDatabase } from 'main_renderer/ipc/proplan'

const sampleDatabase = (): ProplanDatabase => ({
  version: 1,
  globalTaskOrder: ['task-1'],
  projects: [
    {
      id: 'project-1',
      name: '迁移项目',
      description: 'SQLite migration',
      color: '#4f7c6a',
      createdAt: '2026-08-17T00:00:00.000Z',
      updatedAt: '2026-08-17T01:00:00.000Z',
      memos: [
        {
          id: 'memo-1',
          title: '备忘',
          markdown: '# 内容',
          createdAt: '2026-08-17T00:00:00.000Z',
          updatedAt: '2026-08-17T00:30:00.000Z'
        }
      ],
      tasks: [
        {
          id: 'task-1',
          title: '任务',
          markdown: '- [x] 完成',
          completed: true,
          dueAt: '2026-08-20',
          completedAt: '2026-08-17T01:00:00.000Z',
          priority: 'high',
          createdAt: '2026-08-17T00:00:00.000Z',
          updatedAt: '2026-08-17T01:00:00.000Z'
        }
      ],
      timeline: [
        {
          id: 'timeline-1',
          title: '节点',
          markdown: '发布',
          occurredAt: '2026-08-21T08:00:00.000Z',
          createdAt: '2026-08-17T00:00:00.000Z',
          updatedAt: '2026-08-17T00:00:00.000Z'
        }
      ]
    }
  ]
})

describe('Proplan SQLite database', () => {
  let root: string

  beforeEach(async() => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'proplan-sqlite-'))
    electronMock.userDataPath = root
  })

  afterEach(async() => {
    await fs.remove(root)
  })

  it('round-trips all record kinds and replaces the previous snapshot transactionally', () => {
    const databasePath = path.join(root, PROPLAN_DATABASE_FILENAME)
    const initial = sampleDatabase()
    writeProplanDatabase(databasePath, initial)

    expect(readProplanDatabase(databasePath)).toEqual(initial)

    const replacement: ProplanDatabase = { version: 1, projects: [], globalTaskOrder: [] }
    writeProplanDatabase(databasePath, replacement)
    expect(readProplanDatabase(databasePath)).toEqual(replacement)
  })

  it('rolls back the entire replacement when a record violates a constraint', () => {
    const databasePath = path.join(root, PROPLAN_DATABASE_FILENAME)
    const initial = sampleDatabase()
    writeProplanDatabase(databasePath, initial)
    const duplicateRecordDatabase = sampleDatabase()
    duplicateRecordDatabase.projects.push({
      ...structuredClone(duplicateRecordDatabase.projects[0]),
      id: 'project-2',
      name: '重复记录项目'
    })

    expect(() => writeProplanDatabase(databasePath, duplicateRecordDatabase)).toThrow()
    expect(readProplanDatabase(databasePath)).toEqual(initial)
  })

  it('migrates an existing JSON database once and preserves the source as a backup', async() => {
    const legacyPath = path.join(root, LEGACY_PROPLAN_DATA_FILENAME)
    const legacyBackupPath = path.join(root, LEGACY_PROPLAN_BACKUP_FILENAME)
    const databasePath = path.join(root, PROPLAN_DATABASE_FILENAME)
    const initial = sampleDatabase()
    await fs.writeJson(legacyPath, initial)

    await expect(loadDatabase()).resolves.toEqual(initial)
    await expect(fs.pathExists(databasePath)).resolves.toBe(true)
    await expect(fs.pathExists(legacyPath)).resolves.toBe(false)
    await expect(fs.readJson(legacyBackupPath)).resolves.toEqual(initial)

    await fs.writeJson(legacyPath, { version: 1, projects: [] })
    await expect(loadDatabase()).resolves.toEqual(initial)
  })

  it('defaults tasks from older JSON data to medium priority', async() => {
    const legacy = sampleDatabase()
    delete (legacy.projects[0].tasks[0] as Partial<(typeof legacy.projects)[number]['tasks'][number]>).priority
    await fs.writeJson(path.join(root, LEGACY_PROPLAN_DATA_FILENAME), legacy)

    const loaded = await loadDatabase()
    expect(loaded.projects[0]?.tasks[0]?.priority).toBe('medium')
  })
})
