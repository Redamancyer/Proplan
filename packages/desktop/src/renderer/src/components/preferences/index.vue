<template>
  <div class="preferences-dialog-host">
    <el-dialog
      v-model="visible"
      class="preferences-dialog"
      modal-class="preferences-dialog-overlay"
      :title="t('preferences.title')"
      width="min(950px, calc(100vw - 48px))"
      align-center
      destroy-on-close
      close-on-click-modal
      close-on-press-escape
      @closed="handleClosed"
    >
      <div class="pref-container">
        <SideBar
          :active-category="activeCategory"
          @select-category="activeCategory = $event"
        />
        <main class="pref-content">
          <component
            :is="activeComponent"
            class="pref-setting"
          />
        </main>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import bus from '@/bus'
import SideBar from '@/prefComponents/sideBar/index.vue'
import General from '@/prefComponents/general/index.vue'
import Editor from '@/prefComponents/editor/index.vue'
import Markdown from '@/prefComponents/markdown/index.vue'
import SpellChecker from '@/prefComponents/spellchecker/index.vue'
import Theme from '@/prefComponents/theme/index.vue'
import Image from '@/prefComponents/image/index.vue'
import Keybindings from '@/prefComponents/keybindings/index.vue'
import Backup from '@/prefComponents/backup/index.vue'

const { t } = useI18n()
const visible = ref(false)
const activeCategory = ref('general')

const categoryComponents: Record<string, Component> = {
  general: General,
  editor: Editor,
  markdown: Markdown,
  spelling: SpellChecker,
  theme: Theme,
  image: Image,
  keybindings: Keybindings,
  backup: Backup
}

const activeComponent = computed(() => categoryComponents[activeCategory.value] ?? General)

const showDialog = (_event: unknown, category?: string): void => {
  activeCategory.value = category && categoryComponents[category] ? category : 'general'
  visible.value = true
  window.electron.ipcRenderer.send('mt::settings-dialog-visibility', true)
  bus.emit('editor-blur')
}

const handleClosed = (): void => {
  window.electron.ipcRenderer.send('mt::settings-dialog-visibility', false)
}

const removeShowListener = window.electron.ipcRenderer.on(
  'mt::show-settings-dialog',
  showDialog
)

onBeforeUnmount(() => {
  removeShowListener()
  if (visible.value) window.electron.ipcRenderer.send('mt::settings-dialog-visibility', false)
})
</script>

<style>
.preferences-dialog.el-dialog {
  height: min(650px, calc(100vh - 64px));
  max-height: calc(100vh - 64px);
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.preferences-dialog .el-dialog__header {
  flex: none;
  margin: 0;
  padding: 16px 20px 14px;
  border-bottom: 1px solid var(--editorColor10);
}

.preferences-dialog .el-dialog__title {
  color: var(--floatFontColor);
  font-size: 16px;
  font-weight: 500;
}

.preferences-dialog .el-dialog__body {
  flex: 1;
  min-height: 0;
  padding: 0;
}

.preferences-dialog .pref-container {
  --prefSideBarWidth: 220px;

  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  background: var(--editorBgColor);
}

.preferences-dialog .pref-content {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.preferences-dialog .pref-setting {
  box-sizing: border-box;
  flex: 1;
  min-height: 0;
  padding: 30px 40px;
  overflow: auto;
  scrollbar-width: none !important;
}

.preferences-dialog .pref-setting::-webkit-scrollbar,
.preferences-dialog .pref-sidebar .category::-webkit-scrollbar {
  display: none !important;
  width: 0 !important;
  height: 0 !important;
}

.preferences-dialog .pref-content span,
.preferences-dialog .pref-content div,
.preferences-dialog .pref-content h1,
.preferences-dialog .pref-content h2,
.preferences-dialog .pref-content h3,
.preferences-dialog .pref-content h4,
.preferences-dialog .pref-content h5,
.preferences-dialog .pref-content h6 {
  user-select: none;
}

.preferences-dialog h1,
.preferences-dialog h2,
.preferences-dialog h3,
.preferences-dialog h4,
.preferences-dialog h5,
.preferences-dialog h6 {
  color: var(--editorColor);
  font-weight: 500;
  line-height: 1.4;
}

.preferences-dialog h4 {
  margin: 0;
  font-size: 18px;
}

.preferences-dialog h5,
.preferences-dialog h6 {
  font-size: 15px;
}

.preferences-dialog .notes {
  display: block;
  margin: 8px 0 0;
  color: var(--editorColor80);
  font-size: 12px;
  font-style: italic;
}

@media (max-width: 760px) {
  .preferences-dialog .pref-container {
    --prefSideBarWidth: 180px;
  }

  .preferences-dialog .pref-setting {
    padding: 24px;
  }
}
</style>
