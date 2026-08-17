import { COMMON_STYLE_ID, DEFAULT_CODE_FONT_FAMILY, THEME_STYLE_ID } from '../config'
import { isDarkThemeId } from '../../../common/theme'

const themeCss = import.meta.glob('../assets/themes/*.theme.css', {
  eager: true,
  import: 'default',
  query: '?inline'
}) as Record<string, string>
const prismCss = import.meta.glob('../assets/themes/prismjs/*.theme.css', {
  eager: true,
  import: 'default',
  query: '?inline'
}) as Record<string, string>

const cssFor = (files: Record<string, string>, theme: string): string => {
  const suffix = `/${theme}.theme.css`
  return Object.entries(files).find(([filename]) => filename.endsWith(suffix))?.[1] ?? ''
}

export const addThemeStyle = (theme: string): void => {
  let style = document.querySelector(`#${THEME_STYLE_ID}`) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = THEME_STYLE_ID
    document.head.appendChild(style)
  }

  const selected = theme === 'light' ? '' : `${cssFor(themeCss, theme)}\n${cssFor(prismCss, theme)}`
  style.textContent = `@media not print {\n${selected}\n}`
  document.body.classList.toggle('dark', isDarkThemeId(theme))
}

export interface CommonStyleOptions {
  codeFontFamily: string
  codeFontSize: number | string
  hideScrollbar?: boolean
  [key: string]: unknown
}

export const addCommonStyle = ({
  codeFontFamily,
  codeFontSize,
  hideScrollbar
}: CommonStyleOptions): void => {
  let style = document.querySelector(`#${COMMON_STYLE_ID}`) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = COMMON_STYLE_ID
    document.head.appendChild(style)
  }
  const scrollbar = hideScrollbar ? '::-webkit-scrollbar { display: none; }' : ''
  const emojiFont =
    window.electron.process.platform === 'linux'
      ? '.mu-emoji-picker section .emoji-wrapper .item span { font-family: sans-serif, "Noto Color Emoji"; }'
      : ''
  style.textContent = `${scrollbar}\n:root { --codeFontFamily: ${codeFontFamily}, ${DEFAULT_CODE_FONT_FAMILY}; --codeFontSize: ${codeFontSize}px; }\n${emojiFont}`
}

export interface CustomStyleOptions {
  customCss?: string
  [key: string]: unknown
}

export const addCustomStyle = ({ customCss }: CustomStyleOptions): void => {
  let style = document.querySelector('#custom-styles') as HTMLStyleElement | null
  if (!customCss) {
    style?.remove()
    return
  }
  if (!style) {
    style = document.createElement('style')
    style.id = 'custom-styles'
    document.head.appendChild(style)
  }
  style.textContent = customCss
}

export const addStyles = (options: CommonStyleOptions & { theme: string }): void => {
  addThemeStyle(options.theme)
  addCommonStyle(options)
}
