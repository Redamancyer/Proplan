import { defineStore } from 'pinia'
import notice from '../services/notification'

export const useAutoUpdatesStore = defineStore('autoUpdates', () => {
  let listening = false

  function LISTEN_FOR_UPDATE(): void {
    if (listening) return
    listening = true

    window.electron.ipcRenderer.on('mt::UPDATE_CHECKING', (_e, message) => {
      notice.notify({
        title: '检查更新',
        type: 'info',
        message: String(message ?? '')
      }).catch(() => undefined)
    })
    window.electron.ipcRenderer.on('mt::UPDATE_DOWNLOADING', (_e, message) => {
      notice.notify({
        title: '下载更新',
        type: 'info',
        message: String(message ?? '')
      }).catch(() => undefined)
    })
    window.electron.ipcRenderer.on('mt::UPDATE_ERROR', (_e, message) => {
      notice.notify({
        title: '更新失败',
        type: 'error',
        time: 10000,
        message: String(message ?? '')
      }).catch(() => undefined)
    })
    window.electron.ipcRenderer.on('mt::UPDATE_NOT_AVAILABLE', (_e, message) => {
      notice.notify({
        title: '检查更新',
        type: 'success',
        message: String(message ?? '')
      }).catch(() => undefined)
    })
    window.electron.ipcRenderer.on('mt::UPDATE_DOWNLOADED', (_e, message) => {
      notice
        .notify({
          title: '更新已下载',
          type: 'info',
          time: 0,
          message: String(message ?? ''),
          showConfirm: true
        })
        .then(() => window.electron.ipcRenderer.send('mt::INSTALL_UPDATE'))
        .catch(() => undefined)
    })
    window.electron.ipcRenderer.on('mt::UPDATE_AVAILABLE', (_e, message) => {
      notice
        .notify({
          title: '发现新版本',
          type: 'primary',
          time: 0,
          message: String(message ?? ''),
          showConfirm: true
        })
        .then(() => {
          const needUpdate = true
          window.electron.ipcRenderer.send('mt::NEED_UPDATE', { needUpdate })
        })
        .catch(() => {
          const needUpdate = false
          window.electron.ipcRenderer.send('mt::NEED_UPDATE', { needUpdate })
        })
    })
  }

  return { LISTEN_FOR_UPDATE }
})
