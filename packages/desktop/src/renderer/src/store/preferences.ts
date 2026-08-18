import { defineStore } from 'pinia'
import { setLanguage } from '../i18n'

export interface PreferencesState {
  autoSave: boolean
  autoSaveDelay: number
  zoomFactor: number
  titleBarStyle: 'custom' | 'native' | string
  language: string
  editorFontFamily: string
  fontSize: number
  lineHeight: number
  codeFontSize: number
  codeFontFamily: string
  codeBlockLineNumbers: boolean
  trimUnnecessaryCodeBlockEmptyLines: boolean
  wrapCodeBlocks: boolean
  editorLineWidth: string
  autoPairBracket: boolean
  autoPairMarkdownSyntax: boolean
  autoPairQuote: boolean
  textDirection: 'ltr' | 'rtl' | string
  hideQuickInsertHint: boolean
  hideLinkPopup: boolean
  autoCheck: boolean
  preferLooseListItem: boolean
  bulletListMarker: '*' | '+' | '-' | string
  orderListDelimiter: '.' | ')' | string
  tabSize: number
  listIndentation: number | string
  frontmatterType: '-' | ';' | '{' | '+' | string
  superSubScript: boolean
  footnote: boolean
  isHtmlEnabled: boolean
  isGitlabCompatibilityEnabled: boolean
  sequenceTheme: 'hand' | 'simple' | string
  plantumlServer: string
  theme: string
  followSystemTheme: boolean
  lightModeTheme: string
  darkModeTheme: string
  customCss: string
  spellcheckerEnabled: boolean
  spellcheckerNoUnderline: boolean
  spellcheckerLanguage: string
}

const defaults = (): PreferencesState => ({
  autoSave: false,
  autoSaveDelay: 5000,
  zoomFactor: 1,
  titleBarStyle: 'custom',
  language: 'en',
  editorFontFamily: 'Open Sans',
  fontSize: 16,
  lineHeight: 1.6,
  codeFontSize: 14,
  codeFontFamily: 'DejaVu Sans Mono',
  codeBlockLineNumbers: false,
  trimUnnecessaryCodeBlockEmptyLines: true,
  wrapCodeBlocks: false,
  editorLineWidth: '',
  autoPairBracket: true,
  autoPairMarkdownSyntax: true,
  autoPairQuote: true,
  textDirection: 'ltr',
  hideQuickInsertHint: false,
  hideLinkPopup: false,
  autoCheck: false,
  preferLooseListItem: true,
  bulletListMarker: '-',
  orderListDelimiter: '.',
  tabSize: 4,
  listIndentation: 1,
  frontmatterType: '-',
  superSubScript: false,
  footnote: false,
  isHtmlEnabled: true,
  isGitlabCompatibilityEnabled: false,
  sequenceTheme: 'hand',
  plantumlServer: 'https://www.plantuml.com/plantuml',
  theme: 'light',
  followSystemTheme: true,
  lightModeTheme: 'light',
  darkModeTheme: 'dark',
  customCss: '',
  spellcheckerEnabled: false,
  spellcheckerNoUnderline: false,
  spellcheckerLanguage: 'en-US'
})

const initializedPreferenceStores = new WeakSet<object>()

export const usePreferencesStore = defineStore('preferences', {
  state: defaults,
  getters: {
    getAll: (state): PreferencesState => state
  },
  actions: {
    SET_USER_PREFERENCE(preference: Partial<PreferencesState> | Record<string, unknown>): void {
      const oldLanguage = this.language
      for (const [key, value] of Object.entries(preference)) {
        if (value !== undefined && key in defaults()) {
          ;(this as unknown as Record<string, unknown>)[key] = value
        }
      }
      if (this.language !== oldLanguage) setLanguage(this.language)
    },
    ASK_FOR_USER_PREFERENCE(): void {
      if (!initializedPreferenceStores.has(this)) {
        initializedPreferenceStores.add(this)
        window.electron.ipcRenderer.on('mt::user-preference', (_event, preferences) => {
          this.SET_USER_PREFERENCE(preferences as Partial<PreferencesState>)
        })
        window.electron.ipcRenderer.on('language-changed', (_event, language) => {
          if (typeof language === 'string') this.language = language
        })
      }
      window.electron.ipcRenderer.send('mt::ask-for-user-preference')
    },
    SET_SINGLE_PREFERENCE({ type, value }: { type: keyof PreferencesState; value: unknown }): void {
      ;(this as unknown as Record<string, unknown>)[type] = value
      if (type === 'language' && typeof value === 'string') setLanguage(value)
      window.electron.ipcRenderer.send('mt::set-user-preference', { [type]: value })
    }
  }
})
