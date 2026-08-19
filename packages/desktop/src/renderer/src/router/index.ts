import type { RouteRecordRaw } from 'vue-router'
// .vue extensions are explicit so TS resolves them through the *.vue module
// shim in src/types/renderer.d.ts. Vite handles extension-less imports at
// runtime, but vue-tsc needs the suffix.
import App from '@/pages/proplan.vue'

const routes = (_type: string | null | undefined): RouteRecordRaw[] => [
  {
    path: '/',
    redirect: '/editor'
  },
  {
    path: '/editor',
    component: App
  }
]

export default routes
