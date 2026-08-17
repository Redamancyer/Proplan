import { contextBridge, ipcRenderer, webFrame, webUtils } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type {
  BootInfo,
  IpcInvokeChannels,
  IpcMainEventChannels,
  IpcSendChannels,
  IpcSyncChannels
} from '@shared/types/ipc'
import type {
  ProplanDatabase,
  ProplanImageSource,
  ProplanRestoreRequest
} from '@shared/types/proplan'
import type { LicenseDocumentKind } from '@shared/types/licenses'

const invoke = <K extends keyof IpcInvokeChannels>(
  channel: K,
  ...args: IpcInvokeChannels[K]['args']
): Promise<IpcInvokeChannels[K]['ret']> => ipcRenderer.invoke(channel, ...args)

const send = <K extends keyof IpcSendChannels>(channel: K, ...args: IpcSendChannels[K]): void =>
  ipcRenderer.send(channel, ...args)

const bootInfo = ipcRenderer.sendSync('mt::boot-info') as BootInfo

const ipcWrapper = {
  send,
  sendSync: <K extends keyof IpcSyncChannels>(
    channel: K,
    ...args: IpcSyncChannels[K]['args']
  ): IpcSyncChannels[K]['ret'] => ipcRenderer.sendSync(channel, ...args),
  invoke,
  on: <K extends keyof IpcMainEventChannels>(
    channel: K,
    listener: (event: IpcRendererEvent, ...args: IpcMainEventChannels[K]) => void
  ): (() => void) => {
    const subscription = (event: IpcRendererEvent, ...args: unknown[]): void => {
      listener(event, ...(args as IpcMainEventChannels[K]))
    }
    ipcRenderer.on(channel, subscription)
    return () => ipcRenderer.removeListener(channel, subscription)
  },
  once: <K extends keyof IpcMainEventChannels>(
    channel: K,
    listener: (event: IpcRendererEvent, ...args: IpcMainEventChannels[K]) => void
  ): (() => void) => {
    const subscription = (event: IpcRendererEvent, ...args: unknown[]): void => {
      listener(event, ...(args as IpcMainEventChannels[K]))
    }
    ipcRenderer.once(channel, subscription)
    return () => ipcRenderer.removeListener(channel, subscription)
  },
  removeAllListeners: (channel: keyof IpcMainEventChannels | string): void => {
    ipcRenderer.removeAllListeners(channel)
  }
}

const electronAPI = {
  ipcRenderer: ipcWrapper,
  shell: {
    openExternal: (url: string) => invoke('mt::shell::open-external', url),
    showItemInFolder: (fullPath: string) => send('mt::shell::show-item', fullPath),
    openPath: (fullPath: string) => invoke('mt::shell::open-path', fullPath)
  },
  clipboard: {
    writeText: (text: string) => send('mt::clipboard::write-text', text),
    readText: () => invoke('mt::clipboard::read-text'),
    guessFilePath: () => invoke('mt::clipboard::guess-file-path')
  },
  webFrame: {
    setZoomFactor: (factor: number) => webFrame.setZoomFactor(factor),
    setZoomLevel: (level: number) => webFrame.setZoomLevel(level)
  },
  webUtils: {
    getPathForFile: (file: File) => webUtils.getPathForFile(file)
  },
  process: {
    platform: bootInfo.platform,
    arch: bootInfo.arch,
    versions: bootInfo.versions,
    env: bootInfo.env,
    resourcesPath: bootInfo.paths.resources,
    cwd: bootInfo.paths.cwd
  },
  paths: bootInfo.paths,
  isUpdatable: bootInfo.isUpdatable,
  windowControl: {
    minimize: () => send('mt::win::minimize'),
    maximize: () => send('mt::win::maximize'),
    unmaximize: () => send('mt::win::unmaximize'),
    toggleMaximize: () => send('mt::win::toggle-maximize'),
    close: () => send('mt::win::close'),
    setFullScreen: (flag: boolean) => send('mt::win::set-fullscreen', flag),
    toggleFullScreen: () => send('mt::win::toggle-fullscreen'),
    isMaximized: () => invoke('mt::win::is-maximized'),
    isFullScreen: () => invoke('mt::win::is-fullscreen')
  }
}

const proplanAPI = {
  getAssetsPath: () => invoke('mt::proplan::assets-path'),
  openAssetsFolder: () => invoke('mt::proplan::open-assets-folder'),
  backup: () => invoke('mt::proplan::backup'),
  load: () => invoke('mt::proplan::load'),
  importImage: (source: ProplanImageSource) => invoke('mt::proplan::import-image', source),
  restore: (request: ProplanRestoreRequest) => invoke('mt::proplan::restore', request),
  save: (database: ProplanDatabase) => invoke('mt::proplan::save', database)
}

contextBridge.exposeInMainWorld('electron', electronAPI)
contextBridge.exposeInMainWorld('i18nUtils', {
  loadTranslations: (language: string) => invoke('mt::i18n::load', language)
})
contextBridge.exposeInMainWorld('fonts', {
  list: () => invoke('mt::fonts::list')
})
contextBridge.exposeInMainWorld('licenses', {
  read: (kind: LicenseDocumentKind) => invoke('mt::licenses::read', kind)
})
contextBridge.exposeInMainWorld('proplan', proplanAPI)
