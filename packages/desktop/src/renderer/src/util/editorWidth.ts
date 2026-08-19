export const EDITOR_WIDTH_MIN_PERCENT = 50
export const EDITOR_WIDTH_MAX_PERCENT = 100
export const DEFAULT_EDITOR_WIDTH_PERCENT = 80

export const normalizeEditorWidthPercent = (value: unknown): number => {
  const match = typeof value === 'string' ? /^(\d+)%$/.exec(value) : null
  const percent = match ? Number(match[1]) : DEFAULT_EDITOR_WIDTH_PERCENT
  return Math.max(EDITOR_WIDTH_MIN_PERCENT, Math.min(EDITOR_WIDTH_MAX_PERCENT, percent))
}

export const editorWidthCss = (value: unknown): string => `${normalizeEditorWidthPercent(value)}%`
