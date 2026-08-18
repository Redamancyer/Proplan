<template>
  <div
    ref="host"
    class="proplan-editor-host"
    :dir="textDirection"
    @keydown.capture="handleEditorKeydown"
  />
</template>

<script setup lang="ts">
import { computed, markRaw, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { en, Muya, zhCN } from '@muyajs/core'
import type { ILocale } from '@muyajs/core'
import { registerMuyaPlugins } from '@/util/muyaPlugins'
import notice from '@/services/notification'
import { systemTextForLocale, type SystemTextKey } from '@/util/systemLocale'
import { usePreferencesStore } from '@/store/preferences'
import { DEFAULT_CODE_FONT_FAMILY, DEFAULT_EDITOR_FONT_FAMILY } from '@/config'
import type { ProplanImageSource } from '@shared/types/proplan'
import '@muyajs/core'

const props = defineProps<{
  modelValue: string
  recordId: string
}>()

const emit = defineEmits<{
  'update:modelValue': [markdown: string]
}>()

const preferencesStore = usePreferencesStore()
const {
  autoPairBracket,
  autoPairMarkdownSyntax,
  autoPairQuote,
  autoCheck,
  bulletListMarker,
  codeBlockLineNumbers,
  codeFontFamily,
  codeFontSize,
  editorFontFamily,
  fontSize,
  footnote,
  frontmatterType,
  hideLinkPopup,
  hideQuickInsertHint,
  isGitlabCompatibilityEnabled,
  isHtmlEnabled,
  language,
  lineHeight,
  listIndentation,
  orderListDelimiter,
  plantumlServer,
  preferLooseListItem,
  sequenceTheme,
  spellcheckerEnabled,
  spellcheckerNoUnderline,
  superSubScript,
  tabSize,
  textDirection,
  theme,
  trimUnnecessaryCodeBlockEmptyLines,
  wrapCodeBlocks
} = storeToRefs(preferencesStore)

const locales: Record<string, ILocale> = {
  en,
  'zh-CN': zhCN
}
const editorLocale = computed(() => locales[language.value] ?? en)
const systemText = (key: SystemTextKey): string => systemTextForLocale(language.value, key)
const resolveEditorFont = (family: string): string =>
  family ? `${family}, ${DEFAULT_EDITOR_FONT_FAMILY}` : DEFAULT_EDITOR_FONT_FAMILY
const resolveCodeFont = (family: string): string =>
  family ? `${family}, ${DEFAULT_CODE_FONT_FAMILY}` : DEFAULT_CODE_FONT_FAMILY
const isDarkTheme = computed(
  () =>
    ![
      'ayu-light',
      'light',
      'catppuccin-latte',
      'everforest-light',
      'graphite',
      'gruvbox-light',
      'rose-pine-dawn',
      'solarized-light',
      'tokyo-night-light',
      'ulysses'
    ].includes(theme.value)
)

const getPreferenceOptions = () => ({
  autoPairBracket: autoPairBracket.value,
  autoPairMarkdownSyntax: autoPairMarkdownSyntax.value,
  autoPairQuote: autoPairQuote.value,
  autoCheck: autoCheck.value,
  bulletListMarker: bulletListMarker.value,
  codeBlockLineNumbers: codeBlockLineNumbers.value,
  codeFontFamily: resolveCodeFont(codeFontFamily.value),
  codeFontSize: codeFontSize.value,
  disableHtml: !isHtmlEnabled.value,
  editorFontFamily: resolveEditorFont(editorFontFamily.value),
  fontSize: fontSize.value,
  footnote: footnote.value,
  frontMatter: true,
  frontmatterType: frontmatterType.value,
  hideLinkPopup: hideLinkPopup.value,
  hideQuickInsertHint: hideQuickInsertHint.value,
  isGitlabCompatibilityEnabled: isGitlabCompatibilityEnabled.value,
  lineHeight: lineHeight.value,
  listIndentation: listIndentation.value,
  mermaidTheme: isDarkTheme.value ? 'dark' : 'default',
  orderListDelimiter: orderListDelimiter.value,
  plantumlServer: plantumlServer.value,
  preferLooseListItem: preferLooseListItem.value,
  sequenceTheme: sequenceTheme.value as 'hand' | 'simple',
  spellcheckEnabled: spellcheckerEnabled.value,
  spellcheckHideMarks: spellcheckerNoUnderline.value,
  superSubScript: superSubScript.value,
  tabSize: tabSize.value,
  trimUnnecessaryCodeBlockEmptyLines: trimUnnecessaryCodeBlockEmptyLines.value,
  vegaTheme: isDarkTheme.value ? 'dark' : 'latimes',
  wrapCodeBlocks: wrapCodeBlocks.value
})
type EditorPreferenceOptions = ReturnType<typeof getPreferenceOptions>
const preferenceOptions = computed(getPreferenceOptions)

const host = ref<HTMLElement | null>(null)
let editor: InstanceType<typeof Muya> | null = null
let removeEditorCommandListener: (() => void) | null = null

const runEditorCommand = (command: 'undo' | 'redo'): void => {
  if (!editor) return
  if (!host.value?.contains(document.activeElement)) {
    document.execCommand(command)
    return
  }
  if (command === 'undo') editor.undo()
  else editor.redo()
}

const handleEditorKeydown = (event: KeyboardEvent): void => {
  const commandPressed = window.electron.process.platform === 'darwin' ? event.metaKey : event.ctrlKey
  if (!commandPressed || event.altKey) return
  const key = event.key.toLowerCase()
  const undo = key === 'z' && !event.shiftKey
  const redo = (key === 'z' && event.shiftKey) || key === 'y'
  if (!undo && !redo) return
  event.preventDefault()
  event.stopPropagation()
  runEditorCommand(undo ? 'undo' : 'redo')
}

const renderOptionKeys = new Set<keyof EditorPreferenceOptions>([
  'codeBlockLineNumbers',
  'disableHtml',
  'footnote',
  'isGitlabCompatibilityEnabled',
  'listIndentation',
  'mermaidTheme',
  'plantumlServer',
  'sequenceTheme',
  'superSubScript',
  'trimUnnecessaryCodeBlockEmptyLines',
  'vegaTheme'
])

const sourceFromImageState = (src: string): ProplanImageSource => {
  if (/^https?:\/\//i.test(src)) return { kind: 'remote', url: src }
  if (/^data:image\//i.test(src)) return { kind: 'data', dataUrl: src }
  return { kind: 'local', path: src }
}

const persistImage = async (state: { src: string }): Promise<string> => {
  try {
    const result = await window.proplan.importImage(sourceFromImageState(state.src))
    return result?.url ?? state.src
  } catch (error) {
    const message = error instanceof Error ? error.message : systemText('cannotSaveImage')
    notice
      .notify({
        title: systemText('imageSaveFailed'),
        message,
        type: 'error'
      })
      .catch(() => undefined)
    console.error(error)
    return state.src
  }
}

const pickManagedImage = async (): Promise<string> => {
  const result = await window.proplan.importImage({ kind: 'local' })
  return result?.url ?? ''
}

watch(
  () => props.recordId,
  () => {
    if (!editor) return
    editor.setContent(props.modelValue)
    requestAnimationFrame(() => editor?.focus())
  }
)

watch(editorLocale, (locale) => editor?.locale(locale))

watch(
  preferenceOptions,
  (options, previous) => {
    if (!editor) return
    const changedKeys = (Object.keys(options) as (keyof EditorPreferenceOptions)[]).filter(
      (key) => options[key] !== previous?.[key]
    )
    if (changedKeys.length === 0) return
    const changed = Object.fromEntries(
      changedKeys.map((key) => [key, options[key]])
    ) as Partial<EditorPreferenceOptions>
    const forceRender = changedKeys.some((key) => renderOptionKeys.has(key))
    editor.setOptions(changed, forceRender)
  },
  { deep: true }
)

onMounted(() => {
  if (!host.value) return
  registerMuyaPlugins({
    proplanImageAction: persistImage,
    proplanImagePathPicker: pickManagedImage
  })
  editor = markRaw(
    new Muya(host.value, {
      ...preferenceOptions.value,
      markdown: props.modelValue,
      locale: editorLocale.value,
      blockImageQuickInsert: true,
      clipboardText: () => window.electron.clipboard.readText(),
      clipboardFilePath: () => window.electron.clipboard.guessFilePath(),
      imageAction: persistImage,
      getPathForFile: (file: File) => window.electron.webUtils.getPathForFile(file)
    })
  )
  editor.init()
  removeEditorCommandListener = window.electron.ipcRenderer.on(
    'mt::proplan::editor-command',
    (_event, command) => runEditorCommand(command)
  )
  editor.on('json-change', () => {
    if (editor) emit('update:modelValue', editor.getMarkdown())
  })
})

onBeforeUnmount(() => {
  removeEditorCommandListener?.()
  removeEditorCommandListener = null
  editor?.destroy()
  editor = null
})
</script>

<style>
.proplan-editor-host {
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: auto;
  scrollbar-gutter: stable;
  color: var(--editorColor);
  background: var(--editorBgColor);
  cursor: text;
}

.proplan-editor-host .mu-container {
  box-sizing: border-box;
  width: calc(100% - 64px) !important;
  max-width: var(--proplan-editor-max-width, 820px) !important;
  min-height: 100%;
  margin: 0 auto !important;
  padding: 8px 0 45vh !important;
}
</style>
