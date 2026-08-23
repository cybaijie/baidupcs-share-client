<template>
  <aside class="sidebar">
    <div class="logo">
      <el-icon class="logo-icon" :size="28"><FolderOpened /></el-icon>
      <span class="logo-text">网盘客户端</span>
    </div>
    <ul class="sidebar-menu">
      <li
        :class="{ 'is-active': currentPage === 'downloads' }"
        @click="$emit('navigate', 'downloads')"
      >
        <el-icon :size="18"><Download /></el-icon>
        <span>下载管理</span>
      </li>
      <li
        :class="{ 'is-active': currentPage === 'settings' }"
        @click="$emit('navigate', 'settings')"
      >
        <el-icon :size="18"><Setting /></el-icon>
        <span>系统设置</span>
      </li>
    </ul>
    <div class="sidebar-footer">
      <span class="version">v1.0.0</span>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { FolderOpened, Download, Setting } from '@element-plus/icons-vue'
defineProps<{ currentPage: string }>()
defineEmits<{ (e: 'navigate', page: string): void }>()
</script>

<style scoped>
.sidebar {
  width: 200px;
  background: #fff;
  border-right: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  user-select: none;
}
.logo {
  height: 60px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  border-bottom: 1px solid #e4e7ed;
  gap: 10px;
}
.logo-icon { color: #409eff; }
.logo-text { font-size: 16px; font-weight: 600; color: #303133; }
.sidebar-menu {
  flex: 1;
  list-style: none;
  padding: 8px 0;
}
.sidebar-menu li {
  height: 48px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  cursor: pointer;
  transition: all 0.3s;
  color: #606266;
  font-size: 14px;
  gap: 10px;
  border-right: 3px solid transparent;
}
.sidebar-menu li:hover {
  background: #ecf5ff;
  color: #409eff;
}
.sidebar-menu li.is-active {
  background: #ecf5ff;
  color: #409eff;
  border-right-color: #409eff;
}
.sidebar-footer {
  padding: 12px 20px;
  border-top: 1px solid #e4e7ed;
  text-align: center;
}
.version {
  font-size: 12px;
  color: #c0c4cc;
}
</style>
