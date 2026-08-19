<template>
  <div
    class="pref-container"
    :class="{ 'is-visible': isVisible, 'is-closing': isClosing }"
    @transitionend.self="completeClose"
  >
    <title-bar v-if="showCustomTitleBar" />
    <side-bar />
    <div
      class="pref-content"
      :class="{ frameless: titleBarStyle === 'custom' || isOsx }"
    >
      <div
        v-if="!showCustomTitleBar"
        class="title-bar"
      />
      <router-view class="pref-setting" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, onMounted, onUnmounted, nextTick, ref } from 'vue'
import { usePreferencesStore } from '@/store/preferences'
import { storeToRefs } from 'pinia'
import TitleBar from '@/prefComponents/common/titlebar.vue'
import SideBar from '@/prefComponents/sideBar/index.vue'
import { addThemeStyle } from '@/util/theme'
import { DEFAULT_STYLE } from '@/config'
const isOsx = window.electron.process.platform === 'darwin'

// Store
const preferencesStore = usePreferencesStore()
const isVisible = ref(false)
const isClosing = ref(false)
let closeCompleted = false

const removeWindowShownListener = window.electron.ipcRenderer.on('settings::window-shown', () => {
  requestAnimationFrame(() => {
    isVisible.value = true
  })
})
const removeCloseListener = window.electron.ipcRenderer.on('settings::request-close', () => {
  isClosing.value = true
})

const completeClose = (event: TransitionEvent): void => {
  if (!isClosing.value || closeCompleted || event.propertyName !== 'opacity') return
  closeCompleted = true
  window.electron.ipcRenderer.send('settings::close-animation-complete')
}

// Computed properties
const { theme, titleBarStyle } = storeToRefs(preferencesStore)

const showCustomTitleBar = computed<boolean>(() => {
  // Always show the custom title bar on macOS to provide a close button
  if (isOsx) {
    return true
  }
  return titleBarStyle.value === 'custom'
})

// Watchers
watch(theme, (newValue, oldValue) => {
  if (newValue !== oldValue) {
    addThemeStyle(newValue)
  }
})

// Lifecycle
onMounted(() => {
  document.documentElement.classList.add('preference-window')
  nextTick(() => {
    const state = window.proplanBoot?.initialState ?? DEFAULT_STYLE
    addThemeStyle(state.theme ?? DEFAULT_STYLE.theme)

    preferencesStore.ASK_FOR_USER_PREFERENCE()
  })
})

onUnmounted(() => {
  removeWindowShownListener()
  removeCloseListener()
  document.documentElement.classList.remove('preference-window')
})
</script>

<style>
html.preference-window,
html.preference-window body,
html.preference-window * {
  scrollbar-width: none !important;
}

html.preference-window,
html.preference-window body {
  background: transparent !important;
}

html.preference-window::-webkit-scrollbar,
html.preference-window *::-webkit-scrollbar {
  display: none !important;
  width: 0 !important;
  height: 0 !important;
}

.pref-container {
  --prefSideBarWidth: 220px;

  width: 100vw;
  height: 100vh;
  max-width: 100vw;
  max-height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
  display: flex;
  background: var(--editorBgColor);
  opacity: 0;
  transform: translateY(-20px);
  transition:
    opacity var(--el-transition-duration, 300ms) ease,
    transform var(--el-transition-duration, 300ms) ease;
  will-change: opacity, transform;

  &.is-visible {
    opacity: 1;
    transform: translateY(0);
  }

  &.is-closing {
    pointer-events: none;
    opacity: 0;
    transform: translateY(-20px);
  }

  & h1,
  & h2,
  & h3,
  & h4,
  & h5,
  & h6 {
    color: var(--editorColor);
    font-weight: 500;
    line-height: 1.4;
  }

  & h4 {
    margin: 0;
    font-size: 18px;
  }

  & h5 {
    font-size: 15px;
  }

  & h6 {
    font-size: 15px;
  }

  & .notes {
    display: block;
    margin: 8px 0 0;
    font-style: italic;
    font-size: 12px;
    color: var(--editorColor80);
  }

  & .pref-content {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    max-width: calc(100vw - var(--prefSideBarWidth));
    & .title-bar {
      width: 100%;
      height: var(--titleBarHeight);
      position: fixed;
      top: 0;
      right: 0;
      -webkit-app-region: drag;
    }
    & .pref-setting {
      padding: 50px 40px;
      padding-top: var(--titleBarHeight);
      flex: 1;
      height: calc(100vh - var(--titleBarHeight));
      overflow: auto;
    }
    & span,
    & div,
    & h1,
    & h2,
    & h3,
    & h4,
    & h5,
    & h6 {
      user-select: none;
    }
  }
  & .pref-content.frameless .pref-setting {
    /* Move the scrollbar below the titlebar */
    margin-top: var(--titleBarHeight);
    padding-top: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pref-container {
    transition-duration: 0.01ms;
  }
}
</style>
