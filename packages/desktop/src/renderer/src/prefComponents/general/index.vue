<template>
  <div class="pref-general">
    <h4>{{ t('preferences.general.title') }}</h4>
    <compound>
      <template #head>
        <h6 class="title">
          {{ t('preferences.general.autoSave.title') }}
        </h6>
      </template>
      <template #children>
        <bool
          :description="t('preferences.general.autoSave.description')"
          :bool="autoSave"
          :on-change="(value) => onSelectChange('autoSave', value)"
        />
        <range
          :description="t('preferences.general.autoSave.delayDescription')"
          :value="autoSaveDelay"
          :min="1000"
          :max="10000"
          unit="ms"
          :step="100"
          :on-change="(value) => onSelectChange('autoSaveDelay', value)"
        />
      </template>
    </compound>

    <compound>
      <template #head>
        <h6 class="title">
          {{ t('preferences.general.misc.title') }}
        </h6>
      </template>
      <template #children>
        <cur-select
          :description="t('preferences.general.misc.language.title')"
          :value="language"
          :options="getLanguageOptions()"
          :on-change="(value) => onSelectChange('language', value)"
        />
      </template>
    </compound>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { usePreferencesStore } from '@/store/preferences'
import type { PreferencesState } from '@/store/preferences'
import Compound from '../common/compound/index.vue'
import Range from '../common/range/index.vue'
import CurSelect from '../common/select/index.vue'
import Bool from '../common/bool/index.vue'
import { getLanguageOptions } from './config'

const { t } = useI18n()
const preferenceStore = usePreferencesStore()

const { autoSave, autoSaveDelay, language } = storeToRefs(preferenceStore)

const onSelectChange = (type: keyof PreferencesState, value: unknown): void => {
  preferenceStore.SET_SINGLE_PREFERENCE({ type, value })
}
</script>
