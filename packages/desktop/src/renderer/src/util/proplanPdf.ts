import type { ProplanProject, ProplanTask, ProplanTimelineEntry } from '@shared/types/proplan'
import type { ProplanRecord } from '@/store/proplan'
import { formatLocaleDate, systemTextForLocale, type SystemTextKey } from '@/util/systemLocale'

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const isTask = (record: ProplanRecord): record is ProplanTask => 'completed' in record
const isTimeline = (record: ProplanRecord): record is ProplanTimelineEntry => 'occurredAt' in record

const formatDate = (locale: string, value: string, includeTime = false): string => {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return formatLocaleDate(locale, date, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {})
  })
}

export const buildProplanPdfHtml = (
  record: ProplanRecord,
  project: ProplanProject,
  locale: string,
  contentHtml: string
): string => {
  const text = (key: SystemTextKey): string => systemTextForLocale(locale, key)
  const type = isTask(record) ? text('task') : isTimeline(record) ? text('timeline') : text('memo')
  const metadata: Array<[string, string]> = [
    [text('project'), project.name],
    [text('recordType'), type]
  ]

  if (isTask(record)) {
    metadata.push([
      text('recordStatus'),
      text(record.completed ? 'completedTasks' : 'incompleteTasks')
    ])
    metadata.push([
      text('priority'),
      text(
        record.priority === 'high'
          ? 'priorityHigh'
          : record.priority === 'low'
            ? 'priorityLow'
            : 'priorityMedium'
      )
    ])
    metadata.push([
      text('dueDate'),
      record.dueAt ? formatDate(locale, record.dueAt) : text('noDueDate')
    ])
  } else if (isTimeline(record)) {
    metadata.push([text('dateTime'), formatDate(locale, record.occurredAt, true)])
  } else {
    metadata.push([text('updatedAt'), formatDate(locale, record.updatedAt, true)])
  }

  const metadataHtml = metadata
    .map(
      ([label, value]) =>
        `<div class="meta-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
    )
    .join('')

  return `<!doctype html>
<html lang="${escapeHtml(locale)}">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: file: https: http:; style-src 'unsafe-inline'; font-src data:; object-src 'none'; frame-src 'none'; media-src 'none'">
  <title>${escapeHtml(record.title)}</title>
  <style>
    @page { size: A4; margin: 18mm 17mm 20mm; }
    * { box-sizing: border-box; }
    html { color: #202322; background: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 11pt; line-height: 1.65; }
    body { margin: 0; }
    header { margin: 0 0 9mm; padding: 0 0 6mm; border-bottom: 1px solid #d9dddb; }
    h1 { margin: 0 0 4mm; color: #151817; font-size: 24pt; line-height: 1.25; overflow-wrap: anywhere; }
    .meta { display: flex; flex-wrap: wrap; gap: 2.5mm 8mm; color: #646a67; font-size: 9pt; }
    .meta-item { display: flex; gap: 2mm; }
    .meta-item span::after { content: ':'; }
    .meta-item strong { color: #343937; font-weight: 500; }
    .markdown-body { max-width: none !important; color: inherit; font-family: inherit; }
    .markdown-body > :first-child { margin-top: 0; }
    .markdown-body > :last-child { margin-bottom: 0; }
    h2, h3, h4, h5, h6 { break-after: avoid-page; color: #1d211f; line-height: 1.35; }
    h2 { margin: 8mm 0 3mm; padding-bottom: 1.5mm; border-bottom: 1px solid #e4e7e5; font-size: 17pt; }
    h3 { margin: 6mm 0 2mm; font-size: 14pt; }
    h4, h5, h6 { margin: 5mm 0 2mm; font-size: 11.5pt; }
    p, ul, ol, blockquote, pre, table { margin: 0 0 4mm; }
    ul, ol { padding-left: 7mm; }
    li { margin: 1mm 0; }
    a { color: #315f50; text-decoration: underline; overflow-wrap: anywhere; }
    blockquote { padding: 2mm 4mm; border-left: 3px solid #78988c; color: #535b57; background: #f5f7f6; }
    code { padding: .2mm 1mm; border-radius: 2px; background: #f0f2f1; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 9.5pt; overflow-wrap: anywhere; }
    pre { max-width: 100%; padding: 4mm; border: 1px solid #e0e3e1; border-radius: 4px; background: #f7f8f7; white-space: pre-wrap; break-inside: auto; }
    pre code { padding: 0; background: transparent; }
    img, svg, video { max-width: 100%; height: auto; break-inside: avoid-page; }
    table { width: 100%; border-collapse: collapse; break-inside: auto; }
    tr { break-inside: avoid-page; }
    th, td { padding: 2mm 2.5mm; border: 1px solid #d8dcda; text-align: left; vertical-align: top; }
    th { background: #f2f4f3; }
    hr { margin: 7mm 0; border: 0; border-top: 1px solid #d8dcda; }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(record.title)}</h1>
    <div class="meta">${metadataHtml}</div>
  </header>
  <main>${contentHtml}</main>
</body>
</html>`
}
