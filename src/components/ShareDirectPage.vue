<template>
  <div class="share-direct-page">
    <div class="page-header">
      <h2>
        <el-icon :size="22" color="#409eff"><Link /></el-icon>
        分享直下
      </h2>
      <el-button @click="$emit('back')">
        <el-icon><Back /></el-icon>返回下载管理
      </el-button>
    </div>

    <!-- Step 1 -->
    <div v-if="step === 1" class="step-panel">
      <!-- 智能粘贴识别区 -->
      <el-card shadow="never" class="paste-card" style="margin-bottom: 20px">
        <template #header>
          <span>智能粘贴识别区</span>
        </template>
        <el-input
          v-model="pasteText"
          type="textarea"
          :rows="4"
          placeholder="在此处粘贴完整的百度网盘分享文案，例如：
【超级会员V8】通过百度网盘分享的文件…
链接:https://pan.baidu.com/s/1xxxxx?pwd=abcd
复制这段内容打开「百度网盘APP 即可获取」"
          @input="handleSmartPaste"
        />
        <div class="form-tip" style="margin-top: 8px">
          支持自动识别链接和提取码，粘贴后自动填充下方表单
        </div>
      </el-card>

      <el-form :model="form" label-width="100px" style="max-width: 600px;">
        <el-form-item label="分享链接" required>
          <el-input
            v-model="form.link"
            placeholder="https://pan.baidu.com/s/1xxxxx?pwd=abcd"
            :prefix-icon="Link"
            clearable
            @input="extractPwdFromUrl"
          />
          <div class="form-tip">支持自动识别链接中的提取码 (?pwd=xxx)</div>
        </el-form-item>

        <el-form-item label="验证码">
          <el-input
            v-model="form.pwd"
            placeholder="请输入4位提取码"
            maxlength="4"
            show-word-limit
            :prefix-icon="Lock"
            clearable
          />
        </el-form-item>

        <el-form-item label="下载到" required>
          <el-input
            v-model="form.savePath"
            placeholder="请输入下载保存路径"
            :prefix-icon="Folder"
            clearable
          >
            <template #append>
              <el-button @click="saveDefaultPath">设为默认</el-button>
            </template>
          </el-input>
          <div class="form-tip">
            默认路径: {{ settingsStore.config.defaultDownloadPath || './downloads' }}
          </div>
        </el-form-item>

        <el-form-item>
          <el-checkbox v-model="form.autoDelete">
            下载完成后自动删除网盘转存文件
          </el-checkbox>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="loading" @click="handlePreview">
            <el-icon><View /></el-icon>预览文件
          </el-button>
          <el-button type="success" :loading="loading" @click="handleDownloadAll" :disabled="!form.link">
            <el-icon><Download /></el-icon>直下全部
          </el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- Step 2 -->
    <ShareFileSelector
      v-else-if="step === 2"
      :files="fileList"
      :current-path="currentPath"
      :share-info="shareInfo"
      :loading="loading"
      @back="step = 1"
      @enter-folder="enterFolder"
      @selection-change="selectedFiles = $event"
      @confirm="handleStartDownload"
    />

    <!-- Step 3 -->
    <div v-else-if="step === 3" class="step-panel">
      <el-result
        :icon="result?.success ? 'success' : 'error'"
        :title="result?.success ? '任务创建成功' : '任务创建失败'"
        :sub-title="result?.message"
      >
        <template #extra>
          <el-button @click="handleReset">新建任务</el-button>
          <el-button type="primary" @click="$emit('back')">查看下载列表</el-button>
        </template>
      </el-result>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { Link, Lock, Folder, View, Download, Back } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { invoke } from '@tauri-apps/api/core'
import {
  shareApi,
  type ShareFile,
  type ShareInfo,
  type PreviewResponse,
  type TransferResponse
} from '../api/share'
import { useSettingsStore } from '../stores/settings'
import { markAutoDelete } from '../stores/autoDelete'
import ShareFileSelector from './ShareFileSelector.vue'

const emit = defineEmits<{ (e: 'back'): void }>()
const settingsStore = useSettingsStore()

const step = ref(1)
const loading = ref(false)
const fileList = ref<ShareFile[]>([])
const currentPath = ref('/')
const selectedFiles = ref<ShareFile[]>([])
const shareInfo = ref<ShareInfo | null>(null)
const result = ref<{ success: boolean; message: string } | null>(null)
const pasteText = ref('')

const form = reactive({
  link: '',
  pwd: '',
  savePath: '',
  autoDelete: true,
})

onMounted(() => {
  form.savePath = settingsStore.config.defaultDownloadPath || './downloads'
})

const handleSmartPaste = () => {
  const text = pasteText.value
  if (!text) return

  const linkMatches = text.match(/https?:\/\/pan\.baidu\.com\/[^\s"<>]+/gi)
  if (linkMatches && linkMatches.length > 0) {
    const linkWithPwd = linkMatches.find(
      (l) => l.includes('?pwd=') || l.includes('&pwd=')
    )
    form.link = linkWithPwd || linkMatches[0]
    extractPwdFromUrl()
  }

  const pwdMatches = text.match(/(?:提取码|密码|pwd)[\s:：]+([a-zA-Z0-9]{4})/i)
  if (pwdMatches && pwdMatches[1] && !form.pwd) {
    form.pwd = pwdMatches[1]
    ElMessage.success(`已从文案中提取验证码: ${pwdMatches[1]}`)
  }
}

const extractPwdFromUrl = () => {
  const match = form.link.match(/[?&]pwd=([a-zA-Z0-9]{4})/i)
  if (match && match[1]) {
    form.pwd = match[1]
    ElMessage.success(`已自动提取验证码: ${match[1]}`)
  }
}

const saveDefaultPath = () => {
  if (!form.savePath) {
    ElMessage.warning('请输入路径')
    return
  }
  settingsStore.config.defaultDownloadPath = form.savePath
  settingsStore.save()
  ElMessage.success('默认下载路径已保存')
}

const ensureSavePath = async () => {
  if (settingsStore.config.askEveryTime) {
    try {
      const selected = (await invoke('select_folder')) as string
      if (selected) {
        form.savePath = selected
      } else {
        throw new Error('未选择保存目录')
      }
    } catch (e: any) {
      throw new Error('选择保存目录失败: ' + (e.message || '用户取消'))
    }
  }
}

const handlePreview = async () => {
  if (!form.link) {
    ElMessage.warning('请输入分享链接')
    return
  }
  if (!form.savePath) {
    ElMessage.warning('请输入下载路径')
    return
  }
  loading.value = true
  try {
    const data: PreviewResponse = await shareApi.preview({
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

const enterFolder = async (folder: any) => {
  if (!shareInfo.value) return
  loading.value = true
  try {
    const data: PreviewResponse = await shareApi.previewDir({
      short_key: shareInfo.value.short_key,
      shareid: shareInfo.value.shareid,
      uk: shareInfo.value.uk,
      bdstoken: shareInfo.value.bdstoken,
      dir: folder.path,
      kind: shareInfo.value.kind,
      token: shareInfo.value.token
    })
    fileList.value = (data.files || []).map((f: any) => ({ ...f, selected: true }))
    currentPath.value = folder.path
  } catch (e: any) {
    ElMessage.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

const handleDownloadAll = async () => {
  if (!form.link || !form.savePath) {
    ElMessage.warning('请填写完整信息')
    return
  }
  loading.value = true
  try {
    await ensureSavePath()
    const data: TransferResponse = await shareApi.createTransfer({
      share_url: form.link,
      password: form.pwd || undefined,
      save_path: '/',
      save_fs_id: 0,
      auto_download: true,
      local_download_path: form.savePath,
      is_share_direct_download: true,
      auto_delete: form.autoDelete
    })
    result.value = {
      success: true,
      message: `任务ID: ${data.task_id}。${
        form.autoDelete ? '下载完成后将自动清理网盘转存文件。' : ''
      }`
    }
    markAutoDelete(data.task_id, form.autoDelete)
    step.value = 3
    ElMessage.success('已开始下载全部文件')
  } catch (e: any) {
    result.value = { success: false, message: e.message || '创建任务失败' }
    step.value = 3
  } finally {
    loading.value = false
  }
}

const handleStartDownload = async () => {
  if (selectedFiles.value.length === 0) {
    ElMessage.warning('请至少选择一个文件')
    return
  }
  loading.value = true
  try {
    await ensureSavePath()
    const data: TransferResponse = await shareApi.createTransfer({
      share_url: form.link,
      password: form.pwd || undefined,
      save_path: '/',
      save_fs_id: 0,
      auto_download: true,
      local_download_path: form.savePath,
      is_share_direct_download: true,
      selected_fs_ids: selectedFiles.value.map((f) => f.fs_id),
      // 后端通过 selected_files（完整文件信息）支持子目录选择场景，否则无法从根目录文件列表匹配子文件
      selected_files: selectedFiles.value.map((f) => ({
        fs_id: f.fs_id,
        is_dir: f.is_dir,
        path: f.path,
        size: f.size,
        name: f.name,
      })),
      auto_delete: form.autoDelete,
    })
    result.value = {
      success: true,
      message: `任务ID: ${data.task_id}。已选择 ${
        selectedFiles.value.length
      } 个文件。${form.autoDelete ? '下载完成后将自动清理网盘转存文件。' : ''}`
    }
    markAutoDelete(data.task_id, form.autoDelete)
    step.value = 3
    ElMessage.success('下载任务已创建')
  } catch (e: any) {
    result.value = { success: false, message: e.message || '创建任务失败' }
    step.value = 3
  } finally {
    loading.value = false
  }
}

const handleReset = () => {
  step.value = 1
  result.value = null
  fileList.value = []
  selectedFiles.value = []
  shareInfo.value = null
  currentPath.value = '/'
  form.link = ''
  form.pwd = ''
  form.savePath = settingsStore.config.defaultDownloadPath || './downloads'
  pasteText.value = ''
}
</script>

<style scoped>
.share-direct-page {
  padding: 20px;
  max-width: 900px;
  margin: 0 auto;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.page-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
}
.step-panel {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
}
.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
.paste-card :deep(.el-card__header) {
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 500;
}
</style>
