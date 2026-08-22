<template>
  <div class="share-file-selector">
    <div class="step-back">
      <el-button link type="primary" @click="emit('back')">
        <el-icon><ArrowLeft /></el-icon>
        返回修改
      </el-button>
    </div>

    <div class="selector-header">
      <div class="header-top">
        <div class="breadcrumb">
          <el-button link type="primary" size="small" @click="goRoot">根目录</el-button>
          <template v-for="(item, index) in breadcrumbs" :key="index">
            <span class="breadcrumb-sep">/</span>
            <el-button
              link
              :type="index === breadcrumbs.length - 1 ? 'default' : 'primary'"
              size="small"
              :disabled="index === breadcrumbs.length - 1"
              @click="goPath(index)"
            >
              {{ item.name }}
            </el-button>
          </template>
        </div>
      </div>

      <div class="header-bottom">
        <el-checkbox v-model="isAllSelected" @change="handleSelectAll">
          全选
        </el-checkbox>
        <span class="select-info">
          已选 {{ selectedCount }} 个文件
          <span v-if="selectedSize" class="size-info">({{ formatSize(selectedSize) }})</span>
        </span>
      </div>
    </div>

    <el-scrollbar max-height="300px">
      <div class="file-list">
        <div
          v-for="file in files"
          :key="file.fs_id"
          class="file-item"
        >
          <el-checkbox v-model="file.selected" @change="handleItemChange" />

          <el-icon class="file-icon" :class="{ 'folder-icon': file.is_dir }">
            <Folder v-if="file.is_dir" />
            <Document v-else />
          </el-icon>

          <span class="file-name" :title="file.name">{{ file.name }}</span>

          <span
            v-if="file.is_dir"
            class="file-enter"
            @click="emit('enterFolder', file)"
          >
            <el-icon><ArrowRight /></el-icon>
          </span>

          <span class="file-size">
            {{ file.is_dir ? '文件夹' : formatSize(file.size) }}
          </span>
        </div>
      </div>
    </el-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ArrowLeft, ArrowRight, Folder, Document } from '@element-plus/icons-vue'
import type { ShareFile, ShareInfo } from '../api/share'

const props = defineProps<{
  files: ShareFile[]
  currentPath: string
  shareInfo: ShareInfo | null
}>()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'enterFolder', folder: any): void
  (e: 'selectionChange', files: ShareFile[]): void
}>()

const isAllSelected = ref(false)

const breadcrumbs = computed(() => {
  const parts = props.currentPath.split('/').filter(Boolean)
  return parts.map((name, index) => ({
    name,
    path: '/' + parts.slice(0, index + 1).join('/')
  }))
})

const selectedCount = computed(() => props.files.filter(f => f.selected).length)
const selectedSize = computed(() =>
  props.files
    .filter(f => f.selected && !f.is_dir)
    .reduce((sum, f) => sum + (f.size || 0), 0)
)

watch(() => props.files, (newFiles) => {
  isAllSelected.value = newFiles.length > 0 && newFiles.every(f => f.selected)
}, { immediate: true })

const handleSelectAll = (val: boolean) => {
  props.files.forEach(f => f.selected = val)
  emit('selectionChange', props.files.filter(f => f.selected))
}

const handleItemChange = () => {
  isAllSelected.value = props.files.every(f => f.selected)
  emit('selectionChange', props.files.filter(f => f.selected))
}

const goRoot = () => emit('enterFolder', { path: '/' })
const goPath = (index: number) => {
  const path = breadcrumbs.value[index].path
  emit('enterFolder', { path })
}

const formatSize = (bytes: number) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
</script>

<style scoped>
.share-file-selector { padding: 0 4px; }
.step-back { margin-bottom: 12px; }
.selector-header { border-bottom: 1px solid #e4e7ed; padding-bottom: 12px; margin-bottom: 8px; }
.header-top { margin-bottom: 8px; }
.breadcrumb { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; }
.breadcrumb-sep { color: #909399; margin: 0 4px; }
.header-bottom { display: flex; align-items: center; gap: 16px; }
.select-info { font-size: 13px; color: #606266; }
.size-info { color: #909399; margin-left: 4px; }
.file-list { padding: 4px 0; }
.file-item { display: flex; align-items: center; padding: 8px 4px; border-radius: 4px; transition: background 0.2s; }
.file-item:hover { background: #f5f7fa; }
.file-icon { margin: 0 8px; font-size: 18px; color: #409eff; }
.folder-icon { color: #e6a23c; }
.file-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
.file-enter { cursor: pointer; color: #909399; padding: 4px; margin-right: 8px; }
.file-enter:hover { color: #409eff; }
.file-size { font-size: 13px; color: #909399; min-width: 80px; text-align: right; }
</style>