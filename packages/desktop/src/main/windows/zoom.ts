interface ZoomableWebContents {
  getZoomFactor(): number
  setZoomFactor(factor: number): void
  send(channel: string, factor: number): void
}

const MIN_ZOOM = 0.5
const MAX_ZOOM = 2
const ZOOM_STEP = 0.125

export const applyWindowZoom = (
  webContents: ZoomableWebContents,
  direction: 'in' | 'out'
): number => {
  const offset = direction === 'in' ? ZOOM_STEP : -ZOOM_STEP
  const zoomFactor = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, webContents.getZoomFactor() + offset))
  webContents.setZoomFactor(zoomFactor)
  webContents.send('mt::window-zoom', zoomFactor)
  return zoomFactor
}
