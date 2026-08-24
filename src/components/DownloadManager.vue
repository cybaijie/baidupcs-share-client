<template>
  <div class="downloads-container">
    <!-- Toolbar -->
    <div class="toolbar">
      <div class="header-left">
        <h2>下载管理</h2>
        <el-tag :type="activeCount > 0 ? 'success' : 'info'" size="large">
          {{ activeCount }} 个任务进行中
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

    <!-- Stuck warning -->
    <el-alert
      v-if="stuckTasks.length > 0"
      class="stuck-alert"
      type="warning"
      :closable="false"
      show-icon
    >
      <template #title>
        检测到 {{ stuckTasks.length }} 个任务，后端仍显示"下载中"但子文件已全部完成（疑似后端卡住）：{{ stuckTasks.map(t => t.name).slice(0, 3).join('、') }}{{ stuckTasks.length > 3 ? '…' : '' }}。
        请点击右上角"刷新"重试；若后端仍不更新，可删除该任务后重新下载。
      </template>
    </el-alert>

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
                <el-button v-if="card.isFolder" size="small" plain type="info" @click="showDetail(card)">
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
                  <span>{{ row.name }}</span>
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
import { ref, computed, onMounted, onUnmounted, watch, h } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Sort, Refresh, Link, ArrowDown,
  VideoPause, VideoPlay, Delete,
  Folder, Document, Search
} from '@element-plus/icons-vue'
import { downloadApi, type FolderTask, type FileTask, type TransferTask } from '../api/downloads'
import { wsMessageCount } from '../api/websocket'
import { useSettingsStore } from '../stores/settings'
import { getAutoDeleteIds, takeAutoDelete } from '../stores/autoDelete'

const settingsStore = useSettingsStore()
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
let wsDebounce: number | null = null
let lastActiveAt = Date.now()
let autoCleaning = false

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

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

/**
 * 参考 test_baidupcs_api_v7.py 的 resolve_hierarchy：
 * 根据传入 ID 递归关联其所属的 Transfer / Folder / File 以及网盘 .bpr_share_temp/{id} 根目录
 */
function resolveHierarchy(inputId: string) {
  const tSet = new Set<string>()
  const fSet = new Set<string>()
  const dSet = new Set<string>()
  const rawPaths = new Set<string>()
  const dirPath = (t: any) => (t && typeof t === 'object' ? (t.path || t.save_path || t.local_path || t.folder_path || '') : '') || ''

  for (const t of transferTasks.value) {
    if (t.id === inputId) { tSet.add(t.id); const p = dirPath(t); if (p) rawPaths.add(p) }
  }
  for (const f of folderTasks.value) {
    if (f.id === inputId) { fSet.add(f.id); const p = f.path || ''; if (p) rawPaths.add(p) }
  }
  for (const f of fileTasks.value) {
    if (f.id === inputId) { dSet.add(f.id); const p = f.path || f.local_path || f.save_path || ''; if (p) rawPaths.add(p) }
  }

  // 提取网盘临时根目录 /.bpr_share_temp/<UUID>
  const tempRoots = new Set<string>()
  for (const p of rawPaths) { const m = p.match(/(\/\.bpr_share_temp\/[^/]+)/); if (m) tempRoots.add(m[1]) }

  // 依据 tempRoots 扩散关联
  for (const root of tempRoots) {
    for (const t of transferTasks.value) if (dirPath(t).includes(root)) tSet.add(t.id)
    for (const f of folderTasks.value) if ((f.path || '').includes(root)) fSet.add(f.id)
    for (const f of fileTasks.value) if ((f.path || f.local_path || f.save_path || '').includes(root)) dSet.add(f.id)
  }

  // 展开 folder 关联的子文件
  for (const f of folderTasks.value) {
    if (fSet.has(f.id)) {
      for (const sub of fileTasks.value) {
        if (sub.group_id === f.id || sub.folder_id === f.id || sub.parent_task_id === f.id) dSet.add(sub.id)
      }
    }
  }

  // 展开 transfer 关联的子任务
  for (const t of transferTasks.value) {
    if (tSet.has(t.id)) {
      for (const sub of (t.sub_tasks || [])) {
        const sid = sub && typeof sub === 'object' ? (sub.id || sub.task_id) : null
        if (sid) dSet.add(String(sid))
      }
    }
  }

  return {
    transfers: [...tSet],
    folders: [...fSet],
    files: [...dSet],
    tempRoots: [...tempRoots],
  }
}

/**
 * 彻底删除任务（类似 test_baidupcs_api_v7.py --action delete）：
 * 销毁文件夹卡片 / 子文件下载流 / 转存记录 / 网盘临时目录
 */
async function deleteCardLikeScript(inputId: string) {
  const { folders, files, transfers, tempRoots } = resolveHierarchy(inputId)

  // 1. 先暂停
  for (const fid of folders) await downloadApi.pauseFolder(fid)
  for (const did of files) await downloadApi.pauseFile(did)
  await sleep(500)

  // 2. 销毁文件夹任务卡片（同时删除本地文件，同 python 脚本）
  for (const fid of folders) await downloadApi.deleteFolder(fid)
  // 3. 销毁子文件下载流
  for (const did of files) await downloadApi.deleteFile(did)
  // 4. 销毁转存记录
  for (const tid of transfers) await downloadApi.deleteTransfer(tid)
  // 5. 清理网盘临时目录
  if (tempRoots.length) await downloadApi.deleteNetdiskFiles(tempRoots)
}

function showBatchDeleteConfirm(cards: DisplayCard[]) {
  const shown = cards.slice(0, 5)
  const extra = cards.length - shown.length
  const icon = (isFolder: boolean) => (isFolder ? '📁' : '📄')
  const content = h('div', { class: 'batch-delete-confirm' }, [
    h('div', { class: 'bdc-title' }, `将删除 ${cards.length} 个文件/文件夹，请确认：`),
    ...shown.map(c => h('div', { class: 'bdc-item' }, `${icon(c.isFolder)} ${c.name}`)),
    extra > 0 ? h('div', { class: 'bdc-more' }, `...另有 ${extra} 项未展示`) : null,
    h('div', { class: 'bdc-hint' }, '删除将同时清理转存记录与网盘临时文件。'),
  ])
  return ElMessageBox.confirm(content, '批量删除确认', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    confirmButtonClass: 'el-button--danger',
  })
}

// ==================== Computed ====================
function buildCards(): DisplayCard[] {
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
      const folderIsActive = ['downloading', 'running', 'active', 'pending'].includes((folder.status || '').toLowerCase())
      if (allDone && folderIsActive && !anyActive) {
        // 后端文件夹仍显示"下载中"但子文件已全部完成（疑似后端卡住/未完成最终化）：
        // 不再误报"已完成"，保持真实的后端状态，并在顶部提示
        effStatus = 'active'
      } else if (allDone) {
        effStatus = 'completed'
      } else if (anyActive) {
        effStatus = 'active'
      }
    }

    const transfer = transferTasks.value.find(t => {
      if (folder.transfer_id) return t.id === folder.transfer_id
      if (folder.source_id) return t.id === folder.source_id
      return false
    })

    cards.push({
      id: folder.id,
      name: folder.name || 'folder',
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
      name: file.name || 'file',
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

  return cards
}

// 未经过滤/排序的全部卡片（批量操作作用于全部任务，不受状态筛选影响）
const allCards = computed((): DisplayCard[] => buildCards())

const displayCards = computed((): DisplayCard[] => {
  // Filter
  let list = statusFilter.value === 'all'
    ? allCards.value
    : allCards.value.filter(c => c.status === statusFilter.value)

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

const activeCount = computed(() => allCards.value.filter(c => c.status === 'active').length)

// 检测后端疑似卡住的任务：子文件全部完成、进度≥99.5%，但后端文件夹仍显示"下载中"
const stuckSeen = new Map<string, number>()
const stuckTasks = computed(() => {
  const now = Date.now()
  const STUCK_AFTER_MS = 30000
  return displayCards.value.filter(c => {
    if (!c.isFolder) { stuckSeen.delete(c.id); return false }
    const raw = (c.rawStatus || '').toLowerCase()
    const backendActive = ['downloading', 'running', 'active', 'pending'].includes(raw)
    const done = c.totalCount > 0 && c.doneCount === c.totalCount && c.progress >= 99.5
    if (backendActive && done) {
      if (!stuckSeen.has(c.id)) stuckSeen.set(c.id, now)
      return (now - (stuckSeen.get(c.id) || now)) > STUCK_AFTER_MS
    }
    stuckSeen.delete(c.id)
    return false
  })
})

const countByStatus = (status: string) => {
  if (status === 'all') return allCards.value.length
  return allCards.value.filter(c => c.status === status).length
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
  return detailFiles.value.filter(f => (f.name || '').toLowerCase().includes(kw))
})

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
  trackLastActive()
  await handleAutoDelete()
}

function trackLastActive() {
  if (displayCards.value.some(c => c.status === 'active')) {
    lastActiveAt = Date.now()
  }
}

// docker 被动模式：任务暂停超过 1 分钟不再主动轮询，改为被动更新（WebSocket 推送 / 手动刷新）
function shouldPoll() {
  if (settingsStore.config.downloadMode === 'internal') return true
  const active = displayCards.value.some(c => c.status === 'active')
  if (active) return true
  return (Date.now() - lastActiveAt) <= 60000
}

// 勾选了"下载完成后自动删除网盘转存文件"的任务，下载完成后删除转存记录与网盘临时目录
const handleAutoDelete = async () => {
  if (autoCleaning) return
  const ids = getAutoDeleteIds()
  if (!ids.length) return
  autoCleaning = true
  let cleaned = false
  try {
    for (const taskId of ids) {
      const { folders, files, transfers, tempRoots } = resolveHierarchy(taskId)
      const anyDone = folders.some(fid => {
        const f = folderTasks.value.find(x => x.id === fid)
        return f && ['completed', 'done', 'finished'].includes(f.status)
      })
      const fileDone = files.some(did => {
        const d = fileTasks.value.find(x => x.id === did)
        return d && ['completed', 'done', 'finished'].includes(d.status)
      })
      if (anyDone || fileDone) {
        // 收集转存记录 ID（同时通过 taskId 与文件夹的 transfer_id/source_id 关联兜底）
        const transferIds = new Set(transfers)
        if (taskId) transferIds.add(taskId)
        for (const fid of folders) {
          const f = folderTasks.value.find(x => x.id === fid)
          if (f?.transfer_id) transferIds.add(f.transfer_id)
          if (f?.source_id) transferIds.add(f.source_id)
        }
        for (const tid of transferIds) await downloadApi.deleteTransfer(tid)
        if (tempRoots.length) await downloadApi.deleteNetdiskFiles(tempRoots)
        takeAutoDelete(taskId)
        cleaned = true
      }
    }
  } finally {
    autoCleaning = false
  }
  if (cleaned) await fetchAll()
}

const refreshTasks = () => {
  fetchAll()
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
  ElMessage.success('已开始')
  fetchAll()
}

const handleDelete = async (card: DisplayCard) => {
  try {
    await ElMessageBox.confirm(
      '确定删除该任务吗？\n删除将同时清理转存记录与网盘临时文件。',
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消', confirmButtonClass: 'el-button--danger' }
    )
    await deleteCardLikeScript(card.id)
    ElMessage.success('任务已删除')
    fetchAll()
  } catch { /* cancel */ }
}

const handleOpenFolder = async () => {
  // “打开文件夹”已从界面隐藏，函数保留以备将来需要时恢复
}

const showDetail = (card: DisplayCard) => {
  detailFolder.value = card
  detailVisible.value = true
}

// Batch
const batchPause = async () => {
  // 只暂停正在下载的任务（对所有任务生效，不受当前状态筛选影响）
  for (const card of allCards.value.filter(c => c.status === 'active')) {
    await handlePause(card)
  }
}

const batchResume = async () => {
  // 只继续已暂停的任务（对所有任务生效）
  for (const card of allCards.value.filter(c => c.status === 'waiting')) {
    await handleResume(card)
  }
}

const batchDelete = async () => {
  const cards = allCards.value
  if (cards.length === 0) {
    ElMessage.info('没有可删除的任务')
    return
  }
  try {
    await showBatchDeleteConfirm(cards)
    for (const card of cards) {
      await deleteCardLikeScript(card.id)
    }
    ElMessage.success(`已删除 ${cards.length} 个任务`)
    fetchAll()
  } catch { /* cancel */ }
}

const clearCompleted = async () => {
  const completed = allCards.value.filter(c => c.status === 'completed')
  if (completed.length === 0) {
    ElMessage.info('没有已完成任务')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确定清除 ${completed.length} 个已完成任务吗？\n仅删除下载管理里的记录，不删除本地已下载文件，也不清理转存记录/网盘临时文件。`,
      '清除已完成',
      { type: 'warning', confirmButtonText: '清除', cancelButtonText: '取消', confirmButtonClass: 'el-button--danger' }
    )
    for (const card of completed) {
      const { folders, files } = resolveHierarchy(card.id)
      for (const fid of folders) await downloadApi.removeFolderRecord(fid)
      for (const did of files) await downloadApi.removeFileRecord(did)
    }
    ElMessage.success('已清除已完成任务（保留本地文件及转存/网盘记录）')
    fetchAll()
  } catch { /* cancel */ }
}

onMounted(() => {
  fetchAll()
  pollTimer = window.setInterval(() => {
    if (shouldPoll()) fetchAll()
  }, 3000)
})

watch(wsMessageCount, () => {
  if (wsDebounce) clearTimeout(wsDebounce)
  wsDebounce = window.setTimeout(() => fetchAll(), 500)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
  if (wsDebounce) clearTimeout(wsDebounce)
})
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
.stuck-alert { margin-bottom: 12px; }
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

/* Batch delete confirmation */
.batch-delete-confirm { font-size: 14px; line-height: 1.7; }
.bdc-title { margin-bottom: 10px; font-weight: 500; color: #303133; }
.bdc-item {
  padding: 6px 10px;
  border-radius: 6px;
  background: #f5f7fa;
  margin-bottom: 4px;
  word-break: break-all;
}
.bdc-more { color: #909399; font-size: 13px; margin: 6px 0; }
.bdc-hint { color: #e6a23c; font-size: 12px; margin-top: 8px; }
</style>
