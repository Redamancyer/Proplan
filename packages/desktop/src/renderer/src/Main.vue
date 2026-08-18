<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import en from 'element-plus/es/locale/lang/en'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { useAutoUpdatesStore } from '@/store/autoUpdates'

const autoUpdatesStore = useAutoUpdatesStore()
const { locale } = useI18n()
const elementLocale = computed(() => locale.value.toLowerCase().startsWith('zh') ? zhCn : en)
onMounted(() => autoUpdatesStore.LISTEN_FOR_UPDATE())
</script>

<template>
  <div id="app">
    <el-config-provider :locale="elementLocale">
      <!-- This router-view will render either App component (/editor) or Preference component (/preference) -->
      <router-view />
    </el-config-provider>
  </div>
</template>
