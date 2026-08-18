import { createApp, type App } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import bootstrapRenderer from './bootstrap'
import pinia from './store'

// Element Plus instead of Element UI for Vue 3
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

// I18n translation system
import i18nPlugin from './i18n'

import routes from './router'
import Main from './Main.vue'

import './assets/styles/index.css'

// -----------------------------------------------

bootstrapRenderer()

// -----------------------------------------------
// Be careful when changing code before this line!

// Create Vue app
const app: App<Element> = createApp(Main)

app.use(ElementPlus)

const envType = window.proplanBoot?.env?.type ?? undefined

const router = createRouter({
  history: createWebHashHistory(),
  // it seems like something might have changed in vue-router? it uses the full "file path" instead of
  // links like /editor if we use the old createWebHistory()
  routes: routes(envType)
})

app.use(router)
app.use(pinia)
app.use(i18nPlugin)

// Mount the app
app.mount('#app')
