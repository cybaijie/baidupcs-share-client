<template>
  <div class="app-container">
    <Sidebar :current-page="currentPage" @navigate="handleNavigate" />
    <main class="main-content">
      <DownloadManager
        v-if="currentPage === 'downloads'"
        @go-share-direct="currentPage = 'share-direct'"
      />
      <ShareDirectPage
        v-else-if="currentPage === 'share-direct'"
        @back="currentPage = 'downloads'"
      />
      <SettingsPage
        v-else-if="currentPage === 'settings'"
      />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Sidebar from './components/Sidebar.vue'
import DownloadManager from './components/DownloadManager.vue'
import ShareDirectPage from './components/ShareDirectPage.vue'
import SettingsPage from './components/SettingsPage.vue'

type PageType = 'downloads' | 'share-direct' | 'settings'
const currentPage = ref<PageType>('downloads')

function handleNavigate(page: string) {
  currentPage.value = page as PageType
}
</script>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: #f5f7fa;
}
.app-container {
  display: flex;
  height: 100vh;
  overflow: hidden;
}
.main-content {
  flex: 1;
  overflow: auto;
  background: #f5f7fa;
}
</style>
