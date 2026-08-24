<template>
  <div class="share-direct-wrapper">
    <el-dialog
      v-model="visible"
      title="分享直下"
      width="580px"
      :close-on-click-modal="false"
      align-center
      destroy-on-close
    >
      <!-- 第一步：输入分享信息 -->
      <div v-if="step === 1" class="step-form">
        <el-form :model="form" label-width="100px" label-position="right">
          <el-form-item label="分享链接" required>
            <el-input
              v-model="form.link"
              placeholder="请粘贴百度网盘分享链接"
              :prefix-icon="Link"
              clearable
            />
            <div class="form-tip">
              支持格式: pan.baidu.com/s/xxx 或 pan.baidu.com/share/init?surl=xxx
            </div>
          </el-form-item>

          <el-form-item label="提取码">
            <el-input
              v-model="form.pwd"
              placeholder="如有提取码请输入（4位）"
              :prefix-icon="Lock"
              maxlength="4"
              show-word-limit
              clearable
            />
          </el-form-item>

          <el-form-item label="下载到" required>
            <el-input
              v-model="form.savePath"
              placeholder="选择本地下载目录"
              :prefix-icon="Folder"
              readonly
            >
              <template #suffix>
                <el-button link type="primary" @click="selectFolder">
                  选择
                </el-button>
              </template>
            </el-input>
          </el-form-item>
        </el-form>

        <el-alert type="info" :closable="false" class="info-alert">
          <template #title>分享直下说明</template>
          <div class="info-content">
            分享直下会自动将文件转存到网盘临时目录，下载完成后自动清理临时文件。
          </div>
        </el-alert>
      </div>

      <!-- 第二步：文件选择器 -->
      <ShareFileSelector
        v-else-if="step === 2"
        :files="fileList"
        :current-path="currentPath"
        :share-info="shareInfo"
        @back="step = 1"
        @enter-folder="enterFolder"
        @selection-change="selectedFiles = $event"
      />

      <!-- 第三步：进度显示（可选） -->
      <TransferProgress
        v-else-if="step === 3"
        :task-id="createdTaskId"
      />

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="handleCancel">取消</el-button>

          <template v-if="step === 1">
            <el-button type="primary" @click="handleSelectFiles" :loading="loading">
              选择分享文件
            </el-button>
            <el-button type="success" @click="handleDownloadAll" :loading="loading">
              直下全部
            </el-button>
          </template>

          <template v-else-if="step === 2">
            <el-button type="primary" @click="handleStartDownload" :loading="loading">
              开始下载
            </el-button>
          </template>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { Link, Lock, Folder } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { invoke } from '@tauri-apps/api/core'
import { shareApi } from '../api/share'
import { connectWebSocket } from '../api/websocket'
import ShareFileSelector from './ShareFileSelector.vue'
import TransferProgress from './TransferProgress.vue'

const visible = ref(true)
const step = ref(1)
const loading = ref(false)
const fileList = ref<any[]>([])
const currentPath = ref('/')
const selectedFiles = ref<any[]>([])
const shareInfo = ref<any>(null)
const createdTaskId = ref('')

const form = reactive({
  link: '',
  pwd: '',
  savePath: localStorage.getItem('default_download_path') || ''
})

onMounted(() => {
  // 连接 WebSocket
  const serverUrl = localStorage.getItem('server_url') || 'http://192.168.0.15:18888'
  connectWebSocket(serverUrl)
})

// 调用 Windows 原生文件选择器
const selectFolder = async () => {
  try {
    const selected = await invoke('select_folder') as string
    if (selected) {
      form.savePath = selected
      localStorage.setItem('default_download_path', selected)
    }
  } catch (e) {
    console.error(e)
  }
}

// 解析分享链接
const handleSelectFiles = async () => {
  if (!form.link) {
    ElMessage.warning('请输入分享链接')
    return
  }
  if (!form.savePath) {
    ElMessage.warning('请选择下载目录')
    return
  }

  loading.value = true
  try {
    const data = await shareApi.preview({
      share_url: form.link,
      password: form.pwd || undefined
    })

    shareInfo.value = data.share_info
    fileList.value = (data.files || []).map((f: any) => ({ ...f, selected: true }))
    currentPath.value = '/'
    step.value = 2
  } catch (e: any) {
    ElMessage.error(e.message || '解析失败')
  } finally {
    loading.value = false
  }
}

// 进入子目录
const enterFolder = async (folder: any) => {
  loading.value = true
  try {
    const data = await shareApi.previewDir({
      short_key: shareInfo.value?.short_key || '',
      shareid: shareInfo.value?.shareid || '',
      uk: shareInfo.value?.uk || '',
      bdstoken: shareInfo.value?.bdstoken || '',
      dir: folder.path,
      kind: shareInfo.value?.kind || 'personal',
      token: shareInfo.value?.token
    })

    fileList.value = (data.files || []).map((f: any) => ({ ...f, selected: true }))
    currentPath.value = folder.path
  } catch (e: any) {
    ElMessage.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

// 直下全部
const handleDownloadAll = async () => {
  if (!form.link || !form.savePath) {
    ElMessage.warning('请填写完整信息')
    return
  }

  loading.value = true
  try {
    const data = await shareApi.createTransfer({
      share_url: form.link,
      password: form.pwd || undefined,
      save_path: '/',
      save_fs_id: 0,
      auto_download: true,
      local_download_path: form.savePath,
      is_share_direct_download: true
    })

    createdTaskId.value = data.task_id
    ElMessage.success('已开始下载全部文件')
    step.value = 3
  } catch (e: any) {
    ElMessage.error(e.message || '创建任务失败')
  } finally {
    loading.value = false
  }
}

// 开始下载（选中文件）
const handleStartDownload = async () => {
  if (selectedFiles.value.length === 0) {
    ElMessage.warning('请至少选择一个文件')
    return
  }

  loading.value = true
  try {
    const data = await shareApi.createTransfer({
      share_url: form.link,
      password: form.pwd || undefined,
      save_path: '/',
      save_fs_id: 0,
      auto_download: true,
      local_download_path: form.savePath,
      is_share_direct_download: true,
      selected_fs_ids: selectedFiles.value.map((f: any) => f.fs_id)
    })

    createdTaskId.value = data.task_id
    ElMessage.success('下载任务已创建')
    step.value = 3
  } catch (e: any) {
    ElMessage.error(e.message || '创建任务失败')
  } finally {
    loading.value = false
  }
}

const handleCancel = () => {
  if (step.value === 2) {
    step.value = 1
    fileList.value = []
  } else if (step.value === 3) {
    step.value = 1
    createdTaskId.value = ''
  } else {
    visible.value = false
  }
}
</script>

<style scoped>
.share-direct-wrapper {
  padding: 20px;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.info-alert {
  margin-top: 16px;
}

.info-content {
  font-size: 13px;
  line-height: 1.6;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>