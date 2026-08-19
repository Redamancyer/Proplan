import { describe, expect, it } from 'vitest'
import type { ProplanProject, ProplanTask, ProplanTimelineEntry } from '@shared/types/proplan'
import { buildProplanPdfHtml } from '@/util/proplanPdf'

const project: ProplanProject = {
  id: 'project-1',
  name: 'PDF 项目',
  description: '',
  color: '#4f7c6a',
  createdAt: '2026-08-19T08:00:00.000Z',
  updatedAt: '2026-08-19T08:00:00.000Z',
  memos: [],
  tasks: [],
  timeline: []
}

describe('Proplan PDF page', () => {
  it('renders task metadata and escapes record values', () => {
    const task: ProplanTask = {
      id: 'task-1',
      title: '<重要任务>',
      markdown: '',
      completed: false,
      completedAt: null,
      dueAt: '2026-08-20',
      priority: 'high',
      createdAt: '2026-08-19T08:00:00.000Z',
      updatedAt: '2026-08-19T08:00:00.000Z'
    }

    const html = buildProplanPdfHtml(
      task,
      project,
      'zh-CN',
      '<article class="markdown-body"><p>完整正文</p></article>'
    )

    expect(html).toContain('&lt;重要任务&gt;')
    expect(html).not.toContain('<h1><重要任务></h1>')
    expect(html).toContain('<strong>高</strong>')
    expect(html).toContain('<strong>未完成</strong>')
    expect(html).toContain('2026年8月20日')
    expect(html).toContain('完整正文')
    expect(html).toContain('@page { size: A4;')
  })

  it('renders timeline occurrence time', () => {
    const timeline: ProplanTimelineEntry = {
      id: 'timeline-1',
      title: '发布',
      markdown: '',
      occurredAt: '2026-08-19T16:30:00+08:00',
      createdAt: '2026-08-19T08:00:00.000Z',
      updatedAt: '2026-08-19T08:00:00.000Z'
    }

    const html = buildProplanPdfHtml(timeline, project, 'zh-CN', '<article></article>')

    expect(html).toContain('<strong>时间轴</strong>')
    expect(html).toContain('16:30')
  })
})
