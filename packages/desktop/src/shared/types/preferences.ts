export interface IUserPreferences {
  autoSave?: boolean
  autoSaveDelay?: number
  zoomFactor?: number
  titleBarStyle?: 'custom' | 'native'
  language?: string
  editorFontFamily?: string
  fontSize?: number
  lineHeight?: number
  codeFontSize?: number
  codeFontFamily?: string
  codeBlockLineNumbers?: boolean
  trimUnnecessaryCodeBlockEmptyLines?: boolean
  wrapCodeBlocks?: boolean
  editorLineWidth?: string
  autoPairBracket?: boolean
  autoPairMarkdownSyntax?: boolean
  autoPairQuote?: boolean
  textDirection?: 'ltr' | 'rtl'
  hideQuickInsertHint?: boolean
  hideLinkPopup?: boolean
  autoCheck?: boolean
  preferLooseListItem?: boolean
  bulletListMarker?: '-' | '*' | '+'
  orderListDelimiter?: '.' | ')'
  tabSize?: number
  listIndentation?: number | string
  frontmatterType?: '-' | ';' | '+' | '{'
  superSubScript?: boolean
  footnote?: boolean
  isHtmlEnabled?: boolean
  isGitlabCompatibilityEnabled?: boolean
  sequenceTheme?: 'hand' | 'simple'
  plantumlServer?: string
  theme?: string
  followSystemTheme?: boolean
  lightModeTheme?: string
  darkModeTheme?: string
  customCss?: string
  spellcheckerEnabled?: boolean
  spellcheckerNoUnderline?: boolean
  spellcheckerLanguage?: string
  [key: string]: unknown
}
