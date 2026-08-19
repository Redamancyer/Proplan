import { describe, expect, it } from 'vitest'
import {
  DEFAULT_EDITOR_WIDTH_PERCENT,
  editorWidthCss,
  normalizeEditorWidthPercent
} from '@/util/editorWidth'

describe('editor width preference', () => {
  it('uses percentage values and clamps them to the supported slider range', () => {
    expect(normalizeEditorWidthPercent('65%')).toBe(65)
    expect(normalizeEditorWidthPercent('20%')).toBe(50)
    expect(normalizeEditorWidthPercent('120%')).toBe(100)
    expect(editorWidthCss('95%')).toBe('95%')
  })

  it('migrates legacy empty, pixel and character widths to the percentage default', () => {
    expect(normalizeEditorWidthPercent('')).toBe(DEFAULT_EDITOR_WIDTH_PERCENT)
    expect(normalizeEditorWidthPercent('640px')).toBe(DEFAULT_EDITOR_WIDTH_PERCENT)
    expect(normalizeEditorWidthPercent('72ch')).toBe(DEFAULT_EDITOR_WIDTH_PERCENT)
    expect(editorWidthCss(undefined)).toBe(`${DEFAULT_EDITOR_WIDTH_PERCENT}%`)
  })
})
