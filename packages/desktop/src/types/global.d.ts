import type {
  BootInfo,
  IpcInvokeChannels,
  IpcMainEventChannels,
  IpcSendChannels,
  IpcSyncChannels
} from '@shared/types/ipc'
import type { LicenseDocumentKind } from '@shared/types/licenses'
import type {
  ProplanBackupResult,
  ProplanDatabase,
  ProplanImageImportResult,
  ProplanImageSource,
  ProplanRestoreRequest,
  ProplanRestoreResult
} from '@shared/types/proplan'

declare global {
  const MARKTEXT_VERSION: string
  const MARKTEXT_VERSION_STRING: string
  const __static: string

  interface ElectronIpcRenderer {
    send<K extends keyof IpcSendChannels>(channel: K, ...args: IpcSendChannels[K]): void
    sendSync<K extends keyof IpcSyncChannels>(
      channel: K,
      ...args: IpcSyncChannels[K]['args']
    ): IpcSyncChannels[K]['ret']
    invoke<K extends keyof IpcInvokeChannels>(
      channel: K,
      ...args: IpcInvokeChannels[K]['args']
    ): Promise<IpcInvokeChannels[K]['ret']>
    on<K extends keyof IpcMainEventChannels>(
      channel: K,
      listener: (event: unknown, ...args: IpcMainEventChannels[K]) => void
    ): () => void
    once<K extends keyof IpcMainEventChannels>(
      channel: K,
      listener: (event: unknown, ...args: IpcMainEventChannels[K]) => void
    ): () => void
    removeAllListeners(channel: keyof IpcMainEventChannels | string): void
  }

  interface ElectronAPI {
    ipcRenderer: ElectronIpcRenderer
    shell: {
      openExternal(url: string): Promise<boolean>
      showItemInFolder(fullPath: string): void
      openPath(fullPath: string): Promise<string>
    }
    clipboard: {
      writeText(text: string): void
      readText(): Promise<string>
      guessFilePath(): Promise<string | null>
    }
    webFrame: {
      setZoomFactor(factor: number): void
      setZoomLevel(level: number): void
    }
    webUtils: { getPathForFile(file: File): string }
    process: {
      platform: NodeJS.Platform
      arch: string
      versions: Record<string, string>
      env: Record<string, string>
      resourcesPath: string
      cwd: string
    }
    paths: BootInfo['paths']
    isUpdatable: boolean
    windowControl: {
      minimize(): void
      maximize(): void
      unmaximize(): void
      toggleMaximize(): void
      close(): void
      setFullScreen(flag: boolean): void
      toggleFullScreen(): void
      isMaximized(): Promise<boolean>
      isFullScreen(): Promise<boolean>
    }
  }

  interface ProplanAPI {
    getAssetsPath(): Promise<string>
    openAssetsFolder(): Promise<string>
    backup(): Promise<ProplanBackupResult>
    load(): Promise<ProplanDatabase>
    importImage(source: ProplanImageSource): Promise<ProplanImageImportResult | null>
    restore(request: ProplanRestoreRequest): Promise<ProplanRestoreResult>
    save(database: ProplanDatabase): Promise<void>
  }

  interface Window {
    electron: ElectronAPI
    i18nUtils: { loadTranslations(language: string): Promise<Record<string, unknown>> }
    fonts: { list(): Promise<string[]> }
    licenses: { read(kind: LicenseDocumentKind): Promise<string> }
    proplan: ProplanAPI
    proplanBoot?: {
      env?: { type?: string | null; windowId: number }
      initialState?: {
        codeFontFamily?: string | null
        codeFontSize?: string | null
        hideScrollbar?: boolean
        theme?: string | null
        titleBarStyle?: string | null
      }
    }
  }
}

export {}
