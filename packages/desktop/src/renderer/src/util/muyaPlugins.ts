import {
  Muya,
  CodeBlockLanguageSelector,
  EmojiSelector,
  FootnoteTool,
  ImageEditTool,
  ImagePathPicker,
  ImageResizeBar,
  ImageToolBar,
  InlineFormatToolbar,
  LinkTools,
  ParagraphFrontButton,
  ParagraphFrontMenu,
  ParagraphQuickInsertMenu,
  PreviewToolBar,
  TableChessboard,
  TableColumnToolbar,
  TableDragBar,
  TableRowColumMenu
} from '@muyajs/core'

interface ImageEditState {
  src: string
  alt?: string
  title?: string
}

export interface MuyaPluginHandlers {
  imageAction?: (state: ImageEditState) => Promise<string>
  imagePathPicker?: () => Promise<string[]>
  imagePathAutoComplete?: (src: string) => Promise<unknown[]>
  proplanImageAction?: (state: ImageEditState) => Promise<string>
  proplanImagePathPicker?: () => Promise<string>
  jumpClick?: (link: { href?: string | null } | null) => void
}

let registered = false
let handlers: MuyaPluginHandlers = {}

const isProplanMuya = (muya?: Muya): boolean =>
  muya?.domNode.closest('.proplan-editor-host') !== null

const isProplanActive = (muya?: Muya): boolean =>
  isProplanMuya(muya) || document.activeElement?.closest('.proplan-editor-host') !== null

const imageAction = (state: ImageEditState, muya?: Muya): Promise<string> => {
  if (isProplanActive(muya)) {
    return handlers.proplanImageAction?.(state) ?? Promise.resolve(state.src)
  }
  if (!handlers.imageAction) return Promise.resolve(state.src)
  return handlers.imageAction(state)
}

const imagePathPicker = async(muya?: Muya): Promise<string> => {
  if (isProplanActive(muya)) return handlers.proplanImagePathPicker?.() ?? ''
  if (!handlers.imagePathPicker) return ''
  return (await handlers.imagePathPicker())[0] ?? ''
}

const imagePathAutoComplete = (src: string): Promise<unknown[]> => {
  if (isProplanActive() || !handlers.imagePathAutoComplete) return Promise.resolve([])
  return handlers.imagePathAutoComplete(src)
}

const jumpClick = (link: { href?: string | null } | null): void => {
  if (!isProplanActive() && handlers.jumpClick) {
    handlers.jumpClick(link)
    return
  }
  const href = link?.href
  if (href && /^(https?:|mailto:)/i.test(href)) {
    window.electron.shell.openExternal(href).catch(console.error)
  }
}

export const registerMuyaPlugins = (nextHandlers: MuyaPluginHandlers = {}): void => {
  handlers = { ...handlers, ...nextHandlers }
  if (registered) return
  registered = true

  Muya.use(TableChessboard)
  Muya.use(ParagraphQuickInsertMenu)
  Muya.use(CodeBlockLanguageSelector)
  Muya.use(EmojiSelector)
  Muya.use(ImagePathPicker)
  Muya.use(ImageEditTool, {
    imageAction,
    imagePathPicker,
    imagePathAutoComplete,
    processRemoteImage: isProplanMuya
  })
  Muya.use(ImageResizeBar)
  Muya.use(ImageToolBar)
  Muya.use(InlineFormatToolbar)
  Muya.use(ParagraphFrontButton)
  Muya.use(ParagraphFrontMenu)
  Muya.use(PreviewToolBar)
  Muya.use(LinkTools, { jumpClick })
  Muya.use(FootnoteTool)
  Muya.use(TableColumnToolbar)
  Muya.use(TableDragBar)
  Muya.use(TableRowColumMenu)
}
