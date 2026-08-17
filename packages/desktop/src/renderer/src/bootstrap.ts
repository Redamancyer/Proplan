import log from 'electron-log/renderer'

let exceptionLogger: (error: unknown) => void = (error) => console.error(error)

const configureLogger = (): void => {
  const isDev = window.electron.process.env.NODE_ENV === 'development'
  log.transports.console.level = isDev ? 'info' : false
  exceptionLogger = log.error
}

const handleRendererError = (event: ErrorEvent | PromiseRejectionEvent | Event): void => {
  const error = (event as ErrorEvent).error
  if (!error) {
    console.error(event)
    return
  }

  const copy = {
    message: error instanceof Error ? error.message : String(error),
    name: error instanceof Error ? error.name : 'Error',
    stack: error instanceof Error ? error.stack : undefined
  }
  exceptionLogger(error)
  window.electron.ipcRenderer.send('mt::handle-renderer-error', copy)
}

const bootstrapRenderer = (): void => {
  window.addEventListener('error', handleRendererError)
  window.addEventListener('unhandledrejection', handleRendererError)

  const params = new URLSearchParams(window.location.search)
  const windowId = Number(params.get('wid'))
  window.proplanBoot = {
    env: {
      type: params.get('type'),
      windowId: Number.isFinite(windowId) ? windowId : -1
    },
    initialState: {
      codeFontFamily: params.get('cff'),
      codeFontSize: params.get('cfs'),
      hideScrollbar: params.get('hsb') === '1',
      theme: params.get('theme'),
      titleBarStyle: params.get('tbs')
    }
  }
  configureLogger()
}

export default bootstrapRenderer
