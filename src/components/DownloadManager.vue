<template>
  <div class="downloads-page">
    <div class="page-header">
      <div class="header-left">
        <h2>下载管理</h2>
        <el-tag type="info" size="large">{{ activeCount }} 个任务进行中</el-tag>
      </div>
      <div class="header-right">
        <div class="sort-control">
          <el-select v-model="sortBy" style="width: 120px">
            <el-option label="创建时间" value="created_at" />
            <el-option label="名称" value="name" />
            <el-option label="大小" value="size" />
            <el-option label="进度" value="progress" />
            <el-option label="状态" value="status" />
            <el-option label="速度" value="speed" />
          </el-select>
          <el-button @click="sortDesc = !sortDesc">
            <el-icon><Sort /></el-icon>
            {{ sortDesc ? '降序' : '升序' }}
          </el-button>
        </div>
        <el-button @click="refreshTasks">
          <el-icon><Refresh /></el-icon>刷新
        </el-button>
        <el-button type="primary" @click="$emit('go-share-direct')">
          <el-icon><Link /></el-icon>分享直下
        </el-button>
        <el-dropdown>
          <el-button>
            批量操作<el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="batchPause">批量暂停</el-dropdown-item>
              <el-dropdown-item @click="batchResume">批量继续</el-dropdown-item>
              <el-dropdown-item @click="batchDelete" divided>批量删除</el-dropdown-item>
              <el-dropdown-item @click="clearCompleted">清除已完成</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <div class="status-filter-bar">
      <el-radio-group v-model="statusFilter">
        <el-radio-button label="all">
          全部 <span class="status-count">{{ countByStatus('all') }}</span>
        </el-radio-button>
        <el-radio-button label="active">
          下载中 <span class="status-count">{{ countByStatus('active') }}</span>
        </el-radio-button>
        <el-radio-button label="waiting">
          等待中 <span class="status-count">{{ countByStatus('waiting') }}</span>
        </el-radio-button>
        <el-radio-button label="completed">
          已完成 <span class="status-count">{{ countByStatus('completed') }}</span>
        </el-radio-button>
        <el-radio-button label="failed">
          失败 <span class="status-count">{{ countByStatus('failed') }}</span>
        </el-radio-button>
      </el-radio-group>
    </div>

    <div class="task-list">
      <template v-if="displayTasks.length > 0">
        <div v-for="task in displayTasks" :key="task.id" class="task-card">
          <div class="task-header">
            <div class="task-title">
              <el-icon :size="18" :color="task.is_dir ? '#e6a23c' : '#409eff'">
                <Folder v-if="task.is_dir" />
                <Document v-else />
              </el-icon>
              <span class="task-name">{{ task.name }}</span>
            </div>
            <el-tag :type="statusTagType(task.status)" size="small">
              {{ statusText(task.status) }}
            </el-tag>
          </div>
          <div class="task-meta">
            <span>{{ formatSize(task.size) }}</span>
            <span>创建于 {{ task.created_at }}</span>
            <span v-if="task.save_path">保存到: {{ task.save_path }}</span>
          </div>
          <div class="task-progress-row">
            <el-progress
              :percentage="clampProgress(task.progress)"
              :status="task.status === 'failed' ? 'exception' : task.progress >= 100 ? 'success' : ''"
              :stroke-width="8"
              style="flex: 1"
            />
            <span v-if="task.status === 'active'" class="task-speed">{{ task.speed }}/s</span>
          </div>
          <div class="task-actions">
            <el-button v-if="task.status === 'active'" size="small" @click="pauseTask(task.id)">
              <el-icon><VideoPause /></el-icon>暂停
            </el-button>
            <el-button
              v-if="task.status === 'waiting' || task.status === 'failed'"
              size="small"
              type="primary"
              @click="resumeTask(task.id)"
            >
              <el-icon><VideoPlay /></el-icon>继续
            </el-button>
            <el-button size="small" type="danger" plain @click="deleteTask(task.id)">
              <el-icon><Delete /></el-icon>删除
            </el-button>
          </div>
        </div>
      </template>
      <el-empty v-else description="暂无下载任务" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  Sort, Refresh, Link, ArrowDown,
  VideoPause, VideoPlay, Delete,
  Folder, Document
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { downloadApi, type DownloadTask } from '../api/downloads'

defineEmits<{ (e: 'go-share-direct'): void }>()

const tasks = ref<DownloadTask[]>([])
const sortBy = ref('created_at')
const sortDesc = ref(true)
const statusFilter = ref('all')
let pollTimer: number | null = null

const activeCount = computed(() => tasks.value.filter(t => t.status === 'active').length)

const displayTasks = computed(() => {
  let list = statusFilter.value === 'all'
    ? tasks.value
    : tasks.value.filter(t => t.status === statusFilter.value)
  list = [...list].sort((a, b) => {
    let av: any = a[sortBy.value as keyof DownloadTask]
    let bv: any = b[sortBy.value as keyof DownloadTask]
    if (sortBy.value === 'size') { av = a.size; bv = b.size }
    if (sortBy.value === 'progress') { av = a.progress; bv = b.progress }
    if (av < bv) return sortDesc.value ? 1 : -1
    if (av > bv) return sortDesc.value ? -1 : 1
    return 0
  })
  return list
})

const countByStatus = (status: string) => {
  if (status === 'all') return tasks.value.length
  return tasks.value.filter(t => t.status === status).length
}

const statusText = (s: string) =>
  ({ active: '下载中', waiting: '等待中', completed: '已完成', failed: '失败' }[s] || s)

const statusTagType = (s: string): any =>
  ({ active: 'primary', waiting: 'info', completed: 'success', failed: 'danger' }[s] || 'info')

const formatSize = (bytes?: number) => {
  if (!bytes) return '-'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++ }
  return bytes.toFixed(2) + ' ' + units[i]
}

const clampProgress = (p?: number) => Math.min(100, Math.max(0, p || 0))

const fetchTasks = async () => {
  try {
    const data = await downloadApi.list()
    tasks.value = data.tasks || []
  } catch (e: any) {
    console.error('获取任务列表失败:', e)
  }
}

const refreshTasks = () => {
  fetchTasks()
  ElMessage.success('任务列表已刷新')
}

const pauseTask = async (id: string) => {
  try { await downloadApi.pause(id); ElMessage.success('任务已暂停'); fetchTasks() }
  catch (e: any) { ElMessage.error(e.message || '操作失败') }
}

const resumeTask = async (id: string) => {
  try { await downloadApi.resume(id); ElMessage.success('任务已开始'); fetchTasks() }
  catch (e: any) { ElMessage.error(e.message || '操作失败') }
}

const deleteTask = async (id: string) => {
  try {
    await ElMessageBox.confirm('确定删除该任务吗？', '提示', { type: 'warning' })
    await downloadApi.delete(id)
    tasks.value = tasks.value.filter(t => t.id !== id)
    ElMessage.success('任务已删除')
  } catch {}
}

const batchPause = () => {
  tasks.value.forEach(t => { if (t.status === 'active') t.status = 'waiting' })
  ElMessage.success('已暂停所有下载中任务')
}

const batchResume = () => {
  tasks.value.forEach(t => { if (t.status === 'waiting' || t.status === 'failed') t.status = 'active' })
  ElMessage.success('已继续所有任务')
}

const batchDelete = async () => {
  try {
    await ElMessageBox.confirm('确定删除所有任务吗？', '提示', { type: 'warning' })
    tasks.value = []
    ElMessage.success('所有任务已删除')
  } catch {}
}

const clearCompleted = () => {
  tasks.value = tasks.value.filter(t => t.status !== 'completed')
  ElMessage.success('已清除已完成任务')
}

onMounted(() => { fetchTasks(); pollTimer = window.setInterval(fetchTasks, 3000) })
onUnmounted(() => { if (pollTimer) clearInterval(pollTimer) })
</script>

<style scoped>
.downloads-page { padding: 20px; max-width: 1200px; margin: 0 auto; }
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}
.header-left { display: flex; align-items: center; gap: 12px; }
.header-left h2 { margin: 0; font-size: 20px; font-weight: 500; }
.header-right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.sort-control { display: flex; align-items: center; gap: 8px; }
.status-filter-bar { margin-bottom: 16px; }
.status-count { margin-left: 4px; opacity: 0.7; }

.task-list { display: flex; flex-direction: column; gap: 12px; }
.task-card {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 16px;
  transition: box-shadow 0.3s;
}
.task-card:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.task-title { display: flex; align-items: center; gap: 8px; }
.task-name { font-size: 14px; font-weight: 500; color: #303133; }
.task-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #909399;
  margin-bottom: 10px;
}
.task-progress-row { display: flex; align-items: center; gap: 12px; }
.task-speed { font-size: 12px; color: #409eff; min-width: 80px; text-align: right; }
.task-actions { margin-top: 10px; display: flex; gap: 8px; }
</style>
