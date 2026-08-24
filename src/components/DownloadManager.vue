<template>
  <div class="downloads-container">
    <!-- Toolbar -->
    <div class="toolbar">
      <div class="header-left">
        <h2>下载管理</h2>
        <el-tag :type="activeCount > 0 ? 'success' : 'info'" size="large">
          {{ activeCount }} 个任务进行中
        </el-tag>
        <el-tag v-if="!isPolling" type="warning" size="small" style="margin-left:8px">
          被动更新
        </el-tag>
      </div>
      <div class="header-right">
        <div class="sort-control">
          <el-select v-model="sortBy" class="sort-select" style="width: 120px">
            <el-option label="创建时间" value="created_at" />
            <el-option label="名称" value="name" />
            <el-option label="大小" value="size" />
            <el-option label="进度" value="progress" />
            <el-option label="状态" value="status" />
            <el-option label="速度" value="speed" />
          </el-select>
          <el-button @click="sortDesc = !sortDesc" :title="sortDesc ? '降序' : '升序'">
            <el-icon><Sort /></el-icon>
            <span>{{ sortDesc ? '降序' : '升序' }}</span>
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

    <!-- Status Filter -->
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

    <!-- Task List -->
    <div class="task-container">
      <div v-if="displayCards.length > 0" class="task-list">
        <div
          v-for="card in displayCards"
          :key="card.id"
          class="el-card is-hover-shadow task-card"
          :class="{ 'is-folder': card.isFolder, 'task-active': card.status === 'active' }"
          :data-task-id="card.id"
        >
          <div class="el-card__body">
            <!-- Header -->
            <div class="task-header">
              <div class="task-info">
                <div class="task-title">
                  <el-icon class="file-icon" :size="20">
                    <Folder v-if="card.isFolder" />
                    <Document v-else />
                  </el-icon>
                  <span class="filename">{{ card.name }}</span>
                  <el-tag :type="statusTagType(card.status)" size="small">
                    {{ statusText(card.status) }}
                  </el-tag>
                </div>
                <div class="task-path">{{ card.path }}</div>
              </div>
              <div class="task-actions">
                <el-button size="small" plain type="info" @click="showDetail(card)" v-if="card.isFolder">
                  <el-icon><Document /></el-icon> 详情
                </el-button>
                <template v-if="card.status === 'active'">
                  <el-button size="small" @click="handlePause(card)">
                    <el-icon><VideoPause /></el-icon> 暂停
                  </el-button>
                </template>
                <template v-else-if="card.status === 'waiting' || card.status === 'failed'">
                  <el-button size="small" type="primary" @click="handleResume(card)">
                    <el-icon><VideoPlay /></el-icon> 继续
                  </el-button>
                </template>
                <template v-else-if="card.status === 'completed'">
                  <el-button size="small" type="success" @click="handleOpenFolder(card)">
                    <el-icon><FolderOpened /></el-icon> 打开文件夹
                  </el-button>
                </template>
                <el-button size="small" type="danger" @click="handleDelete(card)">
                  <el-icon><Delete /></el-icon> 删除
                </el-button>
              </div>
            </div>

            <!-- Progress -->
            <div class="task-progress">
              <el-progress
                :percentage="Math.min(100, Math.max(0, card.progress))"
                :status="card.status === 'failed' ? 'exception' : card.progress >= 100 ? 'success' : ''"
                :stroke-width="8"
              >
                <template #default>
                  <span class="progress-text">{{ card.progress.toFixed(1) }}%</span>
                </template>
              </el-progress>
            </div>

            <!-- Stats -->
            <div class="task-stats">
              <div class="stat-item">
                <span class="stat-label">进度:</span>
                <span class="stat-value">{{ card.doneCount }}/{{ card.totalCount }} 个文件</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">已下载:</span>
                <span class="stat-value">{{ formatSize(card.downloadedSize) }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">总大小:</span>
                <span class="stat-value">{{ formatSize(card.totalSize) }}</span>
              </div>
              <div v-if="card.status === 'active'" class="stat-item">
                <span class="stat-label">速度:</span>
                <span class="stat-value speed">{{ formatSpeed(card.speed) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <el-empty v-else description="暂无下载任务" />
    </div>

    <!-- Folder Detail Dialog -->
    <el-dialog
      v-model="detailVisible"
      :title="`文件夹详情: ${detailFolder?.name || ''}`"
      width="900px"
      align-center
    >
      <div v-if="detailFolder" class="folder-detail">
        <div class="folder-stats">
          <div class="stat-card">
            <div class="stat-label">总文件数</div>
            <div class="stat-value">{{ detailFolder.totalCount }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">已完成</div>
            <div class="stat-value success">{{ detailFolder.doneCount }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">下载中</div>
            <div class="stat-value primary">
              {{ detailFiles.filter(f => ['downloading','running'].includes(f.status)).length }}
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-label">待处理</div>
            <div class="stat-value info">
              {{ detailFiles.filter(f => ['paused','stopped','waiting','pending'].includes(f.status)).length }}
            </div>
          </div>
        </div>

        <div class="subtasks-container">
          <div class="subtasks-header">
            <span>子任务列表 ({{ detailFiles.length }} 个)</span>
            <el-input
              v-model="detailSearch"
              placeholder="搜索文件名"
              size="small"
              style="width: 250px"
              :prefix-icon="Search"
            />
          </div>
          <el-table
            :data="filteredDetailFiles"
            height="450"
            stripe
            style="width: 100%"
          >
            <el-table-column prop="name" label="文件名" min-width="200">
              <template #default="{ row }">
                <div class="file-name-cell">
                  <el-icon :size="16"><Document /></el-icon>
                  <span>{{ row.name || extractFileNameFromPath(row.path) || extractFileNameFromPath(row.local_path) || extractFileNameFromPath(row.save_path) || 'file' }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100" sortable>
              <template #default="{ row }">
                <el-tag :type="fileStatusTagType(row.status)" size="small">
                  {{ fileStatusText(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="total_size" label="大小" width="120" sortable>
              <template #default="{ row }">
                {{ formatSize((row as FileTask).total_size ?? 0) }}
              </template>
            </el-table-column>
            <el-table-column label="进度" width="180">
              <template #default="{ row }">
                <el-progress
                  :percentage="calcFileProgress(row)"
                  :stroke-width="6"
                >
                  <template #default>
                    <span style="font-size: 12px">{{ calcFileProgress(row).toFixed(1) }}%</span>
                  </template>
                </el-progress>
              </template>
            </el-table-column>
            <el-table-column label="速度" width="120">
              <template #default="{ row }">
                <span v-if="['downloading','running'].includes(row.status)" class="speed-text">
                  {{ formatSpeed((row as FileTask).speed ?? 0) }}
                </span>
                <span v-else class="placeholder-text">-</span>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button type="primary" @click="refreshTasks">
          <el-icon><Refresh /></el-icon> 刷新
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Sort, Refresh, Link, ArrowDown,
  VideoPause, VideoPlay, Delete,
  Folder, Document, FolderOpened, Search
} from '@element-plus/icons-vue'
import { open } from '@tauri-apps/plugin-shell'
import {
  downloadApi,
  markPendingAutoCleanup,
  getPendingAutoCleanup,
  removePendingAutoCleanup,
  type FolderTask,
  type FileTask,
  type TransferTask
} from '../api/downloads'

defineEmits<{ (e: 'go-share-direct'): void }>()

// ==================== Data ====================
const folderTasks = ref<FolderTask[]>([])
const fileTasks = ref<FileTask[]>([])
const transferTasks = ref<TransferTask[]>([])
const sortBy = ref('created_at')
const sortDesc = ref(true)
const statusFilter = ref('all')
const loading = ref(false)
let pollTimer: number | null = null
let lastActiveTime = Date.now()
const isPolling = ref(true)

// Detail dialog
const detailVisible = ref(false)
const detailFolder = ref<DisplayCard | null>(null)
const detailSearch = ref('')

// ==================== Types ====================
type TaskStatus = 'active' | 'waiting' | 'completed' | 'failed'

interface DisplayCard {
  id: string
  name: string
  status: TaskStatus
  rawStatus: string
  path: string
  progress: number
  downloadedSize: number
  totalSize: number
  speed: number
  doneCount: number
  totalCount: number
  isFolder: boolean
  subFiles: FileTask[]
  transferId?: string
  localPath?: string
  createdAt?: string
}

// ==================== Helpers ====================
function extractFileNameFromPath(path?: string): string {
  if (!path) return ''
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] || ''
}

function mapStatus(raw: string): TaskStatus {
  const s = raw?.toLowerCase() || ''
  if (['downloading', 'running', 'active', 'pending'].includes(s)) return 'active'
  if (['paused', 'stopped', 'waiting'].includes(s)) return 'waiting'
  if (['completed', 'done', 'finished', 'success'].includes(s)) return 'completed'
  if (['failed', 'error', 'cancelled'].includes(s)) return 'failed'
  return 'waiting'
}

function statusTagType(s: TaskStatus) {
  return { active: 'warning', waiting: 'info', completed: 'success', failed: 'danger' }[s]
}

function statusText(s: TaskStatus) {
  return { active: '下载中', waiting: '已暂停', completed: '已完成', failed: '失败' }[s]
}

function fileStatusTagType(raw: string) {
  const s = mapStatus(raw)
  return statusTagType(s)
}

function fileStatusText(raw: string) {
  const s = mapStatus(raw)
  return statusText(s)
}

function formatSize(bytes?: number) {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++ }
  return `${size.toFixed(2)} ${units[i]}`
}

function formatSpeed(bytes?: number) {
  return formatSize(bytes) + '/s'
}

function calcFileProgress(file: FileTask) {
  const tot = (file.total_size as number | undefined) ?? 0
  const dl = (file.downloaded_size as number | undefined) ?? 0
  return tot > 0 ? Math.min(100, (dl / tot) * 100) : 0
}

function extractTempRoot(path: string): string | null {
  const m = path.match(/(\/\.bpr_share_temp\/[^/]+)/)
  return m ? m[1] : null
}

// ==================== Hierarchy Resolution ====================
function resolveHierarchy(inputId: string) {
  const matchedTransfers: TransferTask[] = []
  const matchedFolders: FolderTask[] = []
  const matchedFiles: FileTask[] = []
  const rawPaths = new Set<string>()

  // 1. Direct match
  for (const t of transferTasks.value) {
    if (t.id === inputId) {
      matchedTransfers.push(t)
      if (t.save_path) rawPaths.add(t.save_path)
      if (t.path) rawPaths.add(t.path)
    }
  }
  for (const f of folderTasks.value) {
    const fid = f.id || f.folder_id || f.task_id || ''
    if (fid === inputId) {
      matchedFolders.push(f)
      if (f.path) rawPaths.add(f.path)
      if (f.folder_path) rawPaths.add(f.folder_path)
      if (f.save_path) rawPaths.add(f.save_path)
    }
  }
  for (const dt of fileTasks.value) {
    const did = dt.id || dt.task_id || ''
    if (did === inputId) {
      matchedFiles.push(dt)
      if (dt.path) rawPaths.add(dt.path)
      if (dt.local_path) rawPaths.add(dt.local_path)
      if (dt.save_path) rawPaths.add(dt.save_path)
    }
  }

  // 2. Extract temp root dirs
  const tempRootDirs = new Set<string>()
  for (const p of rawPaths) {
    const m = p.match(/(\/\.bpr_share_temp\/[^/]+)/)
    if (m) tempRootDirs.add(m[1])
  }

  // 3. Spread by temp root dirs
  for (const rootDir of tempRootDirs) {
    for (const t of transferTasks.value) {
      const tp = t.save_path || t.path || ''
      if (tp.includes(rootDir) && !matchedTransfers.find(x => x.id === t.id)) {
        matchedTransfers.push(t)
      }
    }
    for (const f of folderTasks.value) {
      const fp = f.path || f.folder_path || f.save_path || ''
      const fid = f.id || f.folder_id || f.task_id || ''
      if (fp.includes(rootDir) && !matchedFolders.find(x => (x.id || x.folder_id || x.task_id) === fid)) {
        matchedFolders.push(f)
      }
    }
    for (const dt of fileTasks.value) {
      const dp = dt.path || dt.local_path || dt.save_path || ''
      const did = dt.id || dt.task_id || ''
      if (dp.includes(rootDir) && !matchedFiles.find(x => (x.id || x.task_id) === did)) {
        matchedFiles.push(dt)
      }
    }
  }

  // 4. Expand folder sub-files
  for (const f of matchedFolders) {
    const fid = f.id || f.folder_id || f.task_id || ''
    for (const dt of fileTasks.value) {
      const did = dt.id || dt.task_id || ''
      if ((dt.group_id === fid || dt.folder_id === fid || dt.parent_task_id === fid) &&
          !matchedFiles.find(x => (x.id || x.task_id) === did)) {
        matchedFiles.push(dt)
      }
    }
    for (const sub of (f.sub_tasks || f.files || f.task_ids || [])) {
      if (typeof sub === 'string') {
        const found = fileTasks.value.find(dt => (dt.id || dt.task_id) === sub)
        if (found && !matchedFiles.find(x => (x.id || x.task_id) === sub)) matchedFiles.push(found)
      } else if (sub && typeof sub === 'object' && sub.id) {
        const found = fileTasks.value.find(dt => (dt.id || dt.task_id) === sub.id)
        if (found && !matchedFiles.find(x => (x.id || x.task_id) === sub.id)) matchedFiles.push(found)
      }
    }
  }

  // 5. Expand transfer sub-tasks
  for (const t of matchedTransfers) {
    for (const sub of (t as any).sub_tasks || []) {
      if (sub && typeof sub === 'object' && sub.id) {
        const found = fileTasks.value.find(dt => (dt.id || dt.task_id) === sub.id)
        if (found && !matchedFiles.find(x => (x.id || x.task_id) === sub.id)) matchedFiles.push(found)
      }
    }
  }

  const allCleanPaths = Array.from(new Set([...rawPaths, ...tempRootDirs]))

  return {
    transfers: matchedTransfers,
    folders: matchedFolders,
    files: matchedFiles,
    savePaths: allCleanPaths,
    tempRootDirs: Array.from(tempRootDirs)
  }
}

// ==================== Deep Delete ====================
async function executeDeepDelete(inputId: string, deleteLocalFiles: boolean) {
  const tree = resolveHierarchy(inputId)

  // Pause
  for (const f of tree.folders) {
    const fid = f.id || f.folder_id || f.task_id || ''
    if (fid) await downloadApi.pauseFolder(fid)
  }
  for (const f of tree.files) {
    const fid = f.id || f.task_id || ''
    if (fid) await downloadApi.pauseFile(fid)
  }

  // Delete folder tasks
  for (const f of tree.folders) {
    const fid = f.id || f.folder_id || f.task_id || ''
    if (fid) {
      if (deleteLocalFiles) await downloadApi.deleteFolder(fid)
      else await downloadApi.deleteFolderRecordOnly(fid)
    }
  }

  // Delete file tasks
  for (const f of tree.files) {
    const fid = f.id || f.task_id || ''
    if (fid) {
      if (deleteLocalFiles) await downloadApi.deleteFile(fid)
      else await downloadApi.deleteFileRecordOnly(fid)
    }
  }

  // Delete transfers
  for (const t of tree.transfers) {
    if (t.id) await downloadApi.deleteTransfer(t.id)
  }

  // Clean netdisk temp dirs
  if (tree.tempRootDirs.length > 0) {
    await downloadApi.deleteNetdiskFiles(tree.tempRootDirs)
  }
}

// ==================== Computed ====================
const displayCards = computed((): DisplayCard[] => {
  const cards: DisplayCard[] = []

  // Folder cards
  for (const folder of folderTasks.value) {
    const subs = fileTasks.value.filter(f =>
      f.group_id === folder.id || f.folder_id === folder.id || f.parent_task_id === folder.id
    )
    const totalSize = subs.reduce((sum, f) => sum + (f.total_size || 0), 0) || (folder.total_size || 0)
    const downloadedSize = subs.reduce((sum, f) => sum + (f.downloaded_size || 0), 0) || (folder.downloaded_size || 0)
    const speed = subs.reduce((sum, f) => sum + (f.speed || 0), 0) || (folder.speed || 0)
    const doneCount = subs.filter(f => ['completed', 'done', 'finished'].includes(f.status)).length
    const totalCount = subs.length || (folder.total_files || 0)
    const progress = totalSize > 0 ? (downloadedSize / totalSize) * 100 : 0

    let effStatus = mapStatus(folder.status)
    if (subs.length > 0) {
      const allDone = subs.every(f => ['completed', 'done', 'finished'].includes(f.status))
      const anyActive = subs.some(f => ['downloading', 'running'].includes(f.status))
      if (allDone) effStatus = 'completed'
      else if (anyActive) effStatus = 'active'
    }

    const transfer = transferTasks.value.find(t => {
      if (folder.transfer_id) return t.id === folder.transfer_id
      if (folder.source_id) return t.id === folder.source_id
      return false
    })

    cards.push({
      id: folder.id,
      name: folder.name || folder.folder_name || extractFileNameFromPath(folder.path) || extractFileNameFromPath(folder.folder_path) || extractFileNameFromPath(folder.save_path) || 'folder',
      status: effStatus,
      rawStatus: folder.status,
      path: folder.path || '',
      progress,
      downloadedSize,
      totalSize,
      speed,
      doneCount,
      totalCount,
      isFolder: true,
      subFiles: subs,
      transferId: transfer?.id,
      localPath: folder.save_path || folder.path,
      createdAt: folder.created_at,
    })
  }

  // Standalone file cards
  const groupedFileIds = new Set(
    fileTasks.value.filter(f => f.group_id || f.folder_id).map(f => f.id)
  )
  for (const file of fileTasks.value) {
    if (groupedFileIds.has(file.id)) continue
    const ftot = file.total_size ?? 0
    const fdl = file.downloaded_size ?? 0
    const progress = ftot > 0 ? (fdl / ftot) * 100 : 0
    cards.push({
      id: file.id,
      name: file.name || file.filename || extractFileNameFromPath(file.path) || extractFileNameFromPath(file.local_path) || extractFileNameFromPath(file.save_path) || 'file',
      status: mapStatus(file.status),
      rawStatus: file.status,
      path: file.path || '',
      progress,
      downloadedSize: file.downloaded_size || 0,
      totalSize: file.total_size || 0,
      speed: file.speed || 0,
      doneCount: ['completed', 'done', 'finished'].includes(file.status) ? 1 : 0,
      totalCount: 1,
      isFolder: false,
      subFiles: [],
      localPath: file.local_path || file.save_path,
      createdAt: file.created_at,
    })
  }

  // Filter
  let list = statusFilter.value === 'all'
    ? cards
    : cards.filter(c => c.status === statusFilter.value)

  // Sort
  list = [...list].sort((a, b) => {
    let av: any, bv: any
    switch (sortBy.value) {
      case 'name': av = a.name; bv = b.name; break
      case 'size': av = a.totalSize; bv = b.totalSize; break
      case 'progress': av = a.progress; bv = b.progress; break
      case 'status': av = a.status; bv = b.status; break
      case 'speed': av = a.speed; bv = b.speed; break
      case 'created_at':
      default: av = a.createdAt || ''; bv = b.createdAt || ''; break
    }
    if (av < bv) return sortDesc.value ? 1 : -1
    if (av > bv) return sortDesc.value ? -1 : 1
    return 0
  })

  return list
})

const activeCount = computed(() => displayCards.value.filter(c => c.status === 'active').length)

const countByStatus = (status: string) => {
  if (status === 'all') return displayCards.value.length
  return displayCards.value.filter(c => c.status === status).length
}

const detailFiles = computed(() => {
  if (!detailFolder.value) return []
  return fileTasks.value.filter(f =>
    f.group_id === detailFolder.value!.id ||
    f.folder_id === detailFolder.value!.id ||
    f.parent_task_id === detailFolder.value!.id
  )
})

const filteredDetailFiles = computed(() => {
  if (!detailSearch.value) return detailFiles.value
  const kw = detailSearch.value.toLowerCase()
  return detailFiles.value.filter(f => {
    const name = (f.name || extractFileNameFromPath(f.path) || extractFileNameFromPath(f.local_path) || extractFileNameFromPath(f.save_path) || '').toLowerCase()
    return name.includes(kw)
  })
})

// ==================== Polling ====================
const startPolling = () => {
  if (pollTimer) return
  isPolling.value = true
  pollTimer = window.setInterval(async () => {
    await fetchAll()
    const hasActive = displayCards.value.some(c => c.status === 'active')
    if (hasActive) {
      lastActiveTime = Date.now()
    } else if (Date.now() - lastActiveTime > 60000) {
      if (pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
        isPolling.value = false
      }
    }
  }, 3000)
}

const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  isPolling.value = false
}

// ==================== Auto Cleanup ====================
const checkAutoCleanup = async () => {
  const pending = getPendingAutoCleanup()
  if (pending.length === 0) return

  for (const taskId of pending) {
    const tree = resolveHierarchy(taskId)

    const allCompleted = tree.folders.every(f => {
      const status = f.status?.toLowerCase() || ''
      return ['completed', 'done', 'finished', 'success'].includes(status)
    }) && tree.files.every(f => {
      const status = f.status?.toLowerCase() || ''
      return ['completed', 'done', 'finished', 'success'].includes(status)
    })

    const noTasks = tree.folders.length === 0 && tree.files.length === 0 && tree.transfers.length === 0

    if (allCompleted || noTasks) {
      await executeDeepDelete(taskId, false)
      removePendingAutoCleanup(taskId)
      ElMessage.success(`任务 ${taskId.slice(0, 8)}... 已完成，网盘临时文件已自动清理`)
    }
  }
}

// ==================== Actions ====================
const fetchAll = async () => {
  loading.value = true
  const [folders, files, transfers] = await Promise.all([
    downloadApi.getFolders(),
    downloadApi.getFiles(),
    downloadApi.getTransfers(),
  ])
  folderTasks.value = folders
  fileTasks.value = files
  transferTasks.value = transfers
  loading.value = false
  await checkAutoCleanup()
}

const refreshTasks = () => {
  fetchAll()
  if (!isPolling.value) {
    lastActiveTime = Date.now()
    startPolling()
  }
  ElMessage.success('任务列表已刷新')
}

const handlePause = async (card: DisplayCard) => {
  if (card.isFolder) {
    await downloadApi.pauseFolder(card.id)
    for (const f of card.subFiles) await downloadApi.pauseFile(f.id)
  } else {
    await downloadApi.pauseFile(card.id)
  }
  ElMessage.success('已暂停')
  fetchAll()
}

const handleResume = async (card: DisplayCard) => {
  if (card.isFolder) {
    await downloadApi.resumeFolder(card.id)
    for (const f of card.subFiles) await downloadApi.resumeFile(f.id)
  } else {
    await downloadApi.resumeFile(card.id)
  }
  lastActiveTime = Date.now()
  startPolling()
  ElMessage.success('已开始')
  fetchAll()
}

const handleDelete = async (card: DisplayCard) => {
  try {
    const tree = resolveHierarchy(card.id)
    const names = [
      ...tree.folders.map(f => f.name || f.folder_name || extractFileNameFromPath(f.path) || '文件夹'),
      ...tree.files.map(f => f.name || f.filename || extractFileNameFromPath(f.path) || '文件')
    ]
    const displayNames = names.slice(0, 5)
    const moreCount = names.length - 5
    let msg = `确定删除该任务吗？`
    if (displayNames.length > 0) {
      msg += '\n\n' + displayNames.map(n => `• ${n}`).join('\n')
      if (moreCount > 0) msg += `\n... 还有 ${moreCount} 个`
    }
    msg += '\n\n⚠️ 本地文件也将被删除'

    await ElMessageBox.confirm(msg, '确认删除', { type: 'warning' })
    await executeDeepDelete(card.id, true)
    ElMessage.success('任务已删除')
    fetchAll()
  } catch { /* cancel */ }
}

const handleOpenFolder = async (card: DisplayCard) => {
  const path = card.localPath || card.path
  if (!path) return
  try {
    await open(path)
  } catch (e: any) {
    ElMessage.error('无法打开文件夹: ' + (e.message || '未知错误'))
  }
}

const showDetail = (card: DisplayCard) => {
  detailFolder.value = card
  detailVisible.value = true
}

// Batch
const batchPause = async () => {
  for (const card of displayCards.value.filter(c => c.status === 'active')) {
    await handlePause(card)
  }
}

const batchResume = async () => {
  for (const card of displayCards.value.filter(c => c.status === 'waiting' || c.status === 'failed')) {
    await handleResume(card)
  }
}

const batchDelete = async () => {
  const cards = displayCards.value
  if (cards.length === 0) {
    ElMessage.info('没有可删除的任务')
    return
  }

  const allNames: string[] = []
  for (const card of cards) {
    const tree = resolveHierarchy(card.id)
    const names = [
      ...tree.folders.map(f => f.name || f.folder_name || extractFileNameFromPath(f.path) || '文件夹'),
      ...tree.files.map(f => f.name || f.filename || extractFileNameFromPath(f.path) || '文件')
    ]
    allNames.push(...names)
  }

  const displayNames = allNames.slice(0, 5)
  const moreCount = allNames.length - 5
  let msg = `确定批量删除 ${allNames.length} 个任务吗？`
  msg += '\n\n' + displayNames.map(n => `• ${n}`).join('\n')
  if (moreCount > 0) msg += `\n... 还有 ${moreCount} 个`
  msg += '\n\n⚠️ 本地文件也将被删除'

  try {
    await ElMessageBox.confirm(msg, '确认批量删除', { type: 'warning' })
    for (const card of cards) {
      await executeDeepDelete(card.id, true)
    }
    ElMessage.success('所有任务已删除')
    fetchAll()
  } catch {}
}

const clearCompleted = async () => {
  const completed = displayCards.value.filter(c => c.status === 'completed')
  if (completed.length === 0) {
    ElMessage.info('没有已完成的任务')
    return
  }
  try {
    await ElMessageBox.confirm(`确定清除 ${completed.length} 个已完成任务吗？\n\n✓ 本地文件将保留`, '确认清除', { type: 'info' })
    for (const card of completed) {
      await executeDeepDelete(card.id, false)
    }
    ElMessage.success('已清除已完成任务')
    fetchAll()
  } catch {}
}

onMounted(() => {
  fetchAll()
  startPolling()
})
onUnmounted(() => { stopPolling() })
</script>

<style scoped>
.downloads-container { padding: 20px; max-width: 1200px; margin: 0 auto; }

.toolbar {
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

.task-container { display: flex; flex-direction: column; gap: 12px; }
.task-list { display: flex; flex-direction: column; gap: 12px; }

.task-card {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  transition: box-shadow 0.3s;
}
.task-card:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
.task-card.task-active { border-left: 3px solid #e6a23c; }
.task-card.is-folder { }

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px 16px 8px;
  gap: 12px;
}
.task-info { flex: 1; min-width: 0; }
.task-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.file-icon { color: #409eff; }
.is-folder .file-icon { color: #e6a23c; }
.filename {
  font-size: 15px;
  font-weight: 500;
  color: #303133;
  word-break: break-all;
}
.task-path {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
  word-break: break-all;
}
.task-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.task-progress { padding: 0 16px 8px; }
.progress-text { font-size: 14px; font-weight: 500; color: #606266; }

.task-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 0 16px 12px;
  font-size: 13px;
}
.stat-item { display: flex; align-items: center; gap: 4px; }
.stat-label { color: #909399; }
.stat-value { color: #606266; font-weight: 500; }
.stat-value.speed { color: #409eff; }

/* Detail Dialog */
.folder-detail { }
.folder-stats {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.stat-card {
  flex: 1;
  min-width: 100px;
  background: #f5f7fa;
  border-radius: 8px;
  padding: 12px;
  text-align: center;
}
.stat-card .stat-label { font-size: 12px; color: #909399; margin-bottom: 4px; }
.stat-card .stat-value { font-size: 20px; font-weight: 600; color: #303133; }
.stat-card .stat-value.success { color: #67c23a; }
.stat-card .stat-value.primary { color: #409eff; }
.stat-card .stat-value.info { color: #909399; }

.subtasks-container { }
.subtasks-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.file-name-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}
.speed-text { color: #409eff; font-weight: 500; }
.placeholder-text { color: #c0c4cc; }
</style>