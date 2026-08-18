<template>
  <ProplanWorkspace :style="{ '--proplan-editor-max-width': editorMaxWidth }" />
  <AboutDialog />
  <div
    v-if="settingsWindowVisible"
    class="settings-window-backdrop"
    aria-hidden="true"
    @pointerdown="closeSettingsWindow"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
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
const settingsWindowVisible = ref(false)
preferencesStore.SET_USER_PREFERENCE(window.proplanBoot?.initialState ?? {})

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
const removeSettingsVisibilityListener = window.electron.ipcRenderer.on(
  'mt::settings-window-visibility',
  (_event, visible) => {
    settingsWindowVisible.value = visible
  }
)
const closeSettingsWindow = (): void => {
  window.electron.ipcRenderer.send('mt::close-setting-window')
}

onUnmounted(() => {
  removeFlushListener()
  removeRestoreListener()
  removeAboutListener()
  removeSettingsVisibilityListener()
})
</script>

<style>
.settings-window-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1800;
  background: rgba(0, 0, 0, 0.24);
}
</style>
