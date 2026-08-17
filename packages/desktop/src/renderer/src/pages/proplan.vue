<template>
  <ProplanWorkspace :style="{ '--proplan-editor-max-width': editorMaxWidth }" />
  <AboutDialog />
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import ProplanWorkspace from '@/components/proplan/ProplanWorkspace.vue'
import AboutDialog from '@/components/about/index.vue'
import bus from '@/bus'
import { usePreferencesStore } from '@/store/preferences'
import { useProplanStore } from '@/store/proplan'
import notice from '@/services/notification'
import { addCustomStyle, addThemeStyle } from '@/util/theme'

const preferencesStore = usePreferencesStore()
const proplanStore = useProplanStore()
preferencesStore.SET_USER_PREFERENCE(window.marktext?.initialState ?? {})

const { customCss, editorLineWidth, theme } = storeToRefs(preferencesStore)
const editorMaxWidth = computed(() =>
  /^(?:[0-9]+(?:ch|px|%)$)/.test(editorLineWidth.value) ? editorLineWidth.value : '820px'
)

watch(theme, addThemeStyle, { immediate: true })
watch(customCss, (value) => addCustomStyle({ customCss: value }), { immediate: true })
onMounted(() => {
  preferencesStore.ASK_FOR_USER_PREFERENCE()
})

const removeFlushListener = window.electron.ipcRenderer.on(
  'mt::proplan::flush-before-backup',
  async (_event, requestId) => {
    let error: string | undefined
    try {
      await proplanStore.flushSave()
    } catch (saveFailure) {
      error = saveFailure instanceof Error ? saveFailure.message : String(saveFailure)
    }
    window.electron.ipcRenderer.send('mt::proplan::flush-before-backup-complete', requestId, error)
  }
)
const removeRestoreListener = window.electron.ipcRenderer.on('mt::proplan::restored', () => {
  proplanStore.reloadFromDisk().catch((error) => {
    notice
      .notify({
        title: '恢复后的界面刷新失败',
        message: `数据已经恢复到磁盘，请重启 Proplan：${error instanceof Error ? error.message : String(error)}`,
        type: 'error',
        time: 20000
      })
      .catch(() => undefined)
  })
})
const removeAboutListener = window.electron.ipcRenderer.on('mt::about-dialog', (_event, license) =>
  bus.emit('aboutDialog', license)
)

onUnmounted(() => {
  removeFlushListener()
  removeRestoreListener()
  removeAboutListener()
})
</script>
