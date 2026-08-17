interface KeyboardInput {
  type: string
  key: string
}

export const shouldExitFullScreen = (input: KeyboardInput, isFullScreen: boolean): boolean =>
  isFullScreen && input.type === 'keyDown' && input.key === 'Escape'
