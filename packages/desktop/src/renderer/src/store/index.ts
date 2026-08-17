import { createPinia, defineStore } from 'pinia'

const pinia = createPinia()

export const useMainStore = defineStore('main', () => ({
  appVersion: window.electron.process.env.MARKTEXT_VERSION_STRING ?? MARKTEXT_VERSION_STRING
}))

export default pinia
