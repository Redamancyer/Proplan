<template>
  <div class="about-dialog">
    <el-dialog
      v-model="showAboutDialog"
      :width="activeLicense ? 'min(840px, 92vw)' : '420px'"
      :title="activeLicense ? licenseTitle : '关于 Proplan'"
      :close-on-click-modal="!activeLicense"
      destroy-on-close
      @closed="resetDialog"
    >
      <template v-if="!activeLicense">
        <img
          class="logo"
          :src="ProplanLogo"
          alt="Proplan"
        >
        <h3 class="title">
          {{ name }}
        </h3>
        <p class="text">
          版本 {{ store.appVersion }}
        </p>
        <p class="text">
          {{ copyright }}
        </p>
        <p class="text upstream-attribution">
          {{ copyrightContributors }}
        </p>

        <div class="license-actions">
          <button
            type="button"
            @click="openLicense('application')"
          >
            软件许可证
          </button>
          <button
            type="button"
            @click="openLicense('thirdParty')"
          >
            第三方开源许可
          </button>
        </div>
      </template>

      <section
        v-else
        class="license-document"
        aria-live="polite"
      >
        <p
          v-if="loading"
          class="license-state"
        >
          正在读取许可证…
        </p>
        <p
          v-else-if="loadError"
          class="license-state error"
        >
          {{ loadError }}
        </p>
        <pre v-else>{{ licenseText }}</pre>
      </section>

      <template
        v-if="activeLicense"
        #footer
      >
        <button
          class="back-button"
          type="button"
          @click="activeLicense = null"
        >
          返回
        </button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { LicenseDocumentKind } from '@shared/types/licenses'
import { useMainStore } from '@/store'
import bus from '../../bus'
import ProplanLogo from '../../assets/images/logo.png'

const store = useMainStore()
const name = 'Proplan'
const copyright = '版权所有 © 2026 Redamancyer'
const copyrightContributors = '基于 MarkText 与 Muya 开发；上游版权声明保留在软件许可证中。'
const showAboutDialog = ref(false)
const activeLicense = ref<LicenseDocumentKind | null>(null)
const licenseText = ref('')
const loadError = ref('')
const loading = ref(false)
let loadSequence = 0

const licenseTitle = computed(() =>
  activeLicense.value === 'thirdParty' ? '第三方开源许可' : '软件许可证'
)

const openLicense = async (kind: LicenseDocumentKind): Promise<void> => {
  const sequence = ++loadSequence
  activeLicense.value = kind
  licenseText.value = ''
  loadError.value = ''
  loading.value = true
  try {
    const text = await window.licenses.read(kind)
    if (sequence === loadSequence) licenseText.value = text
  } catch (error) {
    if (sequence === loadSequence) {
      loadError.value = `无法读取许可证：${error instanceof Error ? error.message : String(error)}`
    }
  } finally {
    if (sequence === loadSequence) loading.value = false
  }
}

const showDialog = (license?: unknown): void => {
  showAboutDialog.value = true
  bus.emit('editor-blur')
  if (license === 'application' || license === 'thirdParty') {
    openLicense(license).catch(() => undefined)
  }
}

const resetDialog = (): void => {
  loadSequence += 1
  activeLicense.value = null
  licenseText.value = ''
  loadError.value = ''
  loading.value = false
}

onMounted(() => bus.on('aboutDialog', showDialog))
onBeforeUnmount(() => bus.off('aboutDialog', showDialog))
</script>

<style>
.about-dialog img.logo {
  display: block;
  width: 80px;
  height: 80px;
  margin: 0 auto 12px;
}

.about-dialog .title,
.about-dialog .text {
  margin: 0 0 8px;
  color: var(--floatFontColor);
  text-align: center;
}

.about-dialog .title {
  font-size: 18px;
}

.about-dialog .upstream-attribution {
  max-width: 340px;
  margin: 12px auto 0;
  color: var(--editorColor50);
  font-size: 12px;
  line-height: 1.5;
}

.about-dialog .license-actions {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 22px;
}

.about-dialog .license-actions button,
.about-dialog .back-button {
  min-height: 32px;
  padding: 5px 12px;
  border: 1px solid var(--editorColor20);
  border-radius: 4px;
  color: var(--floatFontColor);
  background: var(--floatBackColor);
  cursor: pointer;
}

.about-dialog .license-actions button:hover,
.about-dialog .back-button:hover {
  border-color: var(--themeColor);
}

.about-dialog .license-document {
  height: min(62vh, 620px);
  min-height: 320px;
  border: 1px solid var(--editorColor10);
  background: var(--editorColor04);
  overflow: auto;
}

.about-dialog .license-document pre {
  box-sizing: border-box;
  min-width: 100%;
  margin: 0;
  padding: 18px;
  color: var(--floatFontColor);
  font-family: var(--codeFontFamily);
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.about-dialog .license-state {
  margin: 0;
  padding: 24px;
  color: var(--floatFontColor);
  text-align: center;
}

.about-dialog .license-state.error {
  color: var(--errorColor, #c23b3b);
}
</style>
