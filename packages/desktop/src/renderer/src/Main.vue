<script setup lang="ts">
import { onMounted } from 'vue'
import { useAutoUpdatesStore } from '@/store/autoUpdates'

const autoUpdatesStore = useAutoUpdatesStore()
onMounted(() => autoUpdatesStore.LISTEN_FOR_UPDATE())
</script>

<template>
  <div id="app">
    <!-- This router-view will render either App component (/editor) or Preference component (/preference) -->
    <router-view />
  </div>
</template>
