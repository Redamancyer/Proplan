<template>
  <div class="pref-image">
    <h4>{{ t('preferences.image.title') }}</h4>

    <section class="managed-image-settings">
      <div
        v-for="setting in managedSettings"
        :key="setting.label"
        class="managed-setting-row"
      >
        <span class="managed-setting-label">{{ setting.label }}</span>
        <span class="managed-setting-value">{{ setting.value }}</span>
      </div>

      <div class="managed-folder-setting">
        <label for="managed-image-path">
          {{ t('preferences.image.managed.storageLocation') }}
        </label>
        <div class="managed-folder-control">
          <el-input
            id="managed-image-path"
            :model-value="assetsPath"
            readonly
          />
          <el-button
            :icon="FolderOpened"
            @click="showAssetsFolder"
          >
            {{ t('preferences.image.managed.showInFolder') }}
          </el-button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { FolderOpened } from '@element-plus/icons-vue'

const { t } = useI18n()

const assetsPath = ref('')
onMounted(async () => {
  assetsPath.value = await window.proplan.getAssetsPath()
})

const managedSettings = computed(() => [
  {
    label: t('preferences.image.managed.storageMode'),
    value: t('preferences.image.managed.localLibrary')
  },
  {
    label: t('preferences.image.managed.localImages'),
    value: t('preferences.image.managed.copyToLibrary')
  },
  {
    label: t('preferences.image.managed.remoteImages'),
    value: t('preferences.image.managed.downloadToLibrary')
  },
  {
    label: t('preferences.image.managed.fileNaming'),
    value: t('preferences.image.managed.uuidNaming')
  },
  {
    label: t('preferences.image.managed.cleanup'),
    value: t('preferences.image.managed.automaticCleanup')
  }
])

const showAssetsFolder = async (): Promise<void> => {
  await window.proplan.openAssetsFolder()
}
</script>

<style scoped>
.pref-image {
  color: var(--editorColor);
}

.managed-image-settings {
  margin-top: 20px;
  max-width: 720px;
  font-size: 14px;
}

.managed-setting-row {
  min-height: 44px;
  display: grid;
  grid-template-columns: minmax(150px, 0.7fr) minmax(220px, 1.3fr);
  align-items: center;
  gap: 24px;
  border-bottom: 1px solid var(--editorColor10);
}

.managed-setting-label,
.managed-folder-setting label {
  color: var(--editorColor70);
}

.managed-setting-value {
  color: var(--editorColor);
}

.managed-folder-setting {
  padding-top: 18px;
}

.managed-folder-setting label {
  display: block;
  margin-bottom: 10px;
}

.managed-folder-control {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
}

.managed-folder-control :deep(.el-input__wrapper) {
  background: transparent;
}

@media (max-width: 720px) {
  .managed-setting-row {
    grid-template-columns: 1fr;
    gap: 4px;
    padding: 10px 0;
  }

  .managed-folder-control {
    grid-template-columns: 1fr;
  }

  .managed-folder-control :deep(.el-button) {
    justify-self: start;
  }
}
</style>
