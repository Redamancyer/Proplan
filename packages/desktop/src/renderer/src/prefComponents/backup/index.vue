<template>
  <div class="pref-backup">
    <h4>{{ t('preferences.backup.title') }}</h4>

    <section class="backup-section">
      <h6>{{ t('preferences.backup.create.title') }}</h6>
      <p>{{ t('preferences.backup.create.description') }}</p>
      <el-button
        :icon="Download"
        :loading="backingUp"
        @click="createBackup"
      >
        {{ t('preferences.backup.create.button') }}
      </el-button>
      <div
        v-if="lastBackupPath"
        class="result-path"
      >
        <span>{{ lastBackupPath }}</span>
        <el-button
          text
          :icon="FolderOpened"
          :title="systemText('showInFolder')"
          @click="showLastBackup"
        />
      </div>
    </section>

    <separator />

    <section class="backup-section restore-section">
      <h6>{{ t('preferences.backup.restore.title') }}</h6>
      <p>{{ t('preferences.backup.restore.description') }}</p>
      <p class="warning-text">
        <WarningFilled />
        <span>{{ t('preferences.backup.restore.warning') }}</span>
      </p>
      <el-button
        :icon="Upload"
        :loading="restoring"
        @click="restoreBackup"
      >
        {{ t('preferences.backup.restore.button') }}
      </el-button>
      <p class="safety-note">
        {{ t('preferences.backup.restore.safetyCopy') }}
      </p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Download, FolderOpened, Upload, WarningFilled } from '@element-plus/icons-vue'
import notice from '@/services/notification'
import {
  systemTextForLocale,
  type SystemTextKey,
  type SystemTextParams
} from '@/util/systemLocale'
import Separator from '../common/separator/index.vue'

const { locale, t } = useI18n()
const systemText = (key: SystemTextKey, params: SystemTextParams = {}): string =>
  systemTextForLocale(locale.value, key, params)
const backingUp = ref(false)
const restoring = ref(false)
const lastBackupPath = ref('')

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const createBackup = async (): Promise<void> => {
  backingUp.value = true
  try {
    const result = await window.proplan.backup()
    if (result.status !== 'saved') return
    lastBackupPath.value = result.filePath ?? ''
    await notice.notify({
      title: systemText('backupSucceeded'),
      message: systemText('backupSuccessMessage', { count: result.assetCount ?? 0 }),
      type: 'primary'
    })
  } catch (error) {
    await notice.notify({
      title: systemText('backupFailed'),
      message: errorMessage(error),
      type: 'error'
    })
  } finally {
    backingUp.value = false
  }
}

const restoreBackup = async (): Promise<void> => {
  restoring.value = true
  try {
    const result = await window.proplan.restore({
      confirmTitle: systemText('restoreConfirmTitle'),
      confirmMessage: systemText('restoreConfirmMessage'),
      confirmDetail: systemText('restoreConfirmDetail'),
      confirmButton: systemText('restoreConfirmButton'),
      cancelButton: systemText('cancel')
    })
    if (result.status !== 'restored') return
    await notice.notify({
      title: systemText('restoreSucceeded'),
      message: systemText('restoreSuccessMessage', { count: result.assetCount ?? 0 }),
      type: 'primary'
    })
  } catch (error) {
    await notice.notify({
      title: systemText('restoreFailed'),
      message: errorMessage(error),
      type: 'error'
    })
  } finally {
    restoring.value = false
  }
}

const showLastBackup = (): void => {
  if (lastBackupPath.value) window.electron.shell.showItemInFolder(lastBackupPath.value)
}
</script>

<style scoped>
.pref-backup {
  color: var(--editorColor);
  max-width: 760px;
}

.backup-section {
  margin: 28px 0 32px;
}

.backup-section h6 {
  margin: 0 0 8px;
}

.backup-section p {
  max-width: 680px;
  margin: 0 0 18px;
  color: var(--editorColor70);
  font-size: 14px;
  line-height: 1.6;
}

.result-path {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  margin-top: 14px;
  color: var(--editorColor60);
  font-size: 12px;
}

.result-path span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.warning-text {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: var(--warningColor, #b26a2f) !important;
}

.warning-text svg {
  width: 16px;
  height: 16px;
  flex: none;
  margin-top: 3px;
}

.backup-section .safety-note {
  margin-top: 12px;
  margin-bottom: 0;
  font-size: 12px;
  color: var(--editorColor50);
}
</style>
