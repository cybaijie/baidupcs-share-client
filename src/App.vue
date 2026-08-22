<template>
  <div class="app">
    <ShareDirectDialog />
  </div>
</template>

<script setup lang="ts">
import ShareDirectDialog from './components/ShareDirectDialog.vue'
</script>

<style>
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f7fa;
}
.app {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>