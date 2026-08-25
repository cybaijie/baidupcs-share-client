<template>
  <div class="settings-page">
    <h2>系统设置</h2>

    <!-- 服务器连接 -->
    <el-card class="setting-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <el-icon :size="20" color="#409eff"><Connection /></el-icon>
          <span>服务器连接</span>
        </div>
      </template>
      <el-form :model="settings" label-width="140px">
        <el-form-item label="后端地址">
          <el-input
            v-model="settings.serverUrl"
            placeholder="http://192.168.0.15:18888"
            clearable
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="testingServer" @click="testServerConnection">
            测试连接
          </el-button>
          <span class="conn-status">
            <span class="dot" :class="serverStatus"></span>
            {{ serverStatusText }}
          </span>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- Web 访问认证 -->
    <el-card class="setting-card auth-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <el-icon :size="20" color="#409eff"><Lock /></el-icon>
          <span>Web 访问认证</span>
        </div>
      </template>

      <div class="auth-status-bar">
        <span class="status-label">认证状态</span>
        <el-tag :type="settings.token ? 'success' : 'info'" size="small">
          {{ settings.token ? '已登录' : '未登录' }}
        </el-tag>
        <span v-if="settings.token" class="token-hint">Token 已保存</span>
      </div>

      <el-divider />

      <el-form label-width="140px">
        <el-form-item label="认证模式">
          <el-radio-group v-model="settings.authMode" size="small" @change="onAuthModeChange">
            <el-radio-button label="none">无认证</el-radio-button>
            <el-radio-button label="password">仅密码</el-radio-button>
            <el-radio-button label="2fa">仅2FA</el-radio-button>
            <el-radio-button label="password_2fa">密码+2FA</el-radio-button>
          </el-radio-group>
          <div class="form-tip">选择与后端实际配置一致的认证方式</div>
        </el-form-item>

        <el-form-item label="密码" v-if="showPassword">
          <el-input
            v-model="loginForm.password"
            type="password"
            show-password
            placeholder="输入后端访问密码"
            style="max-width: 300px"
          />
        </el-form-item>

        <el-form-item label="2FA 验证码" v-if="show2FA">
          <el-input
            v-model="loginForm.totpCode"
            placeholder="输入 6 位 TOTP 验证码"
            maxlength="6"
            style="max-width: 300px"
          />
        </el-form-item>

        <el-form-item v-if="settings.authMode !== 'none'">
          <el-checkbox v-model="settings.savePassword">记住密码</el-checkbox>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="loggingIn" @click="handleLogin">
            {{ settings.token ? '重新登录' : '登录' }}
          </el-button>
          <el-button v-if="settings.token" @click="handleLogout">退出登录</el-button>
        </el-form-item>
      </el-form>

      <el-alert
        v-if="loginMsg"
        :type="loginSuccess ? 'success' : 'error'"
        :title="loginMsg"
        show-icon
        :closable="false"
        style="margin-top: 12px"
      />
    </el-card>

    <!-- 下载配置 -->
    <el-card class="setting-card" shadow="hover" id="section-download">
      <template #header>
        <div class="card-header">
          <el-icon :size="20" color="#67c23a"><Download /></el-icon>
          <span>下载配置</span>
        </div>
      </template>

      <el-alert type="success" :closable="false" style="margin-bottom: 20px">
        <template #title>智能分片大小</template>
        <div style="line-height: 1.8; font-size: 13px">
          系统会根据文件大小和您的VIP等级自动选择最优分片大小：<br>
          • 小文件（&lt;5MB）使用 256KB 分片<br>
          • 中等文件（5-10MB）使用 512KB 分片<br>
          • 中大型文件（10-500MB）使用 1MB-4MB 分片<br>
          • 大文件（&ge;500MB）使用 5MB 分片<br>
          • VIP限制：普通用户最高4MB，普通会员最高4MB，SVIP最高5MB<br>
          • 注意：百度网盘限制单个Range请求最大5MB，超过会返回403错误
        </div>
      </el-alert>

      <el-form :model="settings" label-width="140px">
        <el-form-item label="默认下载目录" required>
          <div class="input-with-button">
            <el-input
              v-model="settings.defaultDownloadPath"
              placeholder="请输入绝对路径，例如: /app/downloads 或 D:\Downloads"
            >
              <template #prepend>
                <el-icon><Folder /></el-icon>
              </template>
            </el-input>
            <el-button type="primary" @click="selectDownloadFolder">
              <el-icon><FolderOpened /></el-icon> 浏览
            </el-button>
          </div>
          <div class="form-tip">
            文件下载的保存目录，必须使用绝对路径<br>
            Windows 示例: <code>D:\Downloads</code> 或 <code>C:\Users\YourName\Downloads</code><br>
            Linux/Docker 示例: <code>/app/downloads</code> 或 <code>/home/user/downloads</code>
          </div>
        </el-form-item>

        <el-form-item label="下载时选择目录">
          <el-switch
            v-model="settings.askEveryTime"
            active-text="每次询问"
            inactive-text="使用默认"
          />
          <div class="form-tip">
            开启后，每次下载都会弹出文件资源管理器让您选择保存位置；关闭后将直接使用默认下载目录
          </div>
        </el-form-item>

        <el-form-item label="下载方式">
          <el-radio-group v-model="settings.downloadMode" size="small">
            <el-radio-button label="docker">Docker 直下</el-radio-button>
            <el-radio-button label="internal">内部下载</el-radio-button>
          </el-radio-group>
          <div class="form-tip">
            <b>Docker 直下</b>：下载由服务器端（Docker 后端）负责执行，本软件只负责查看进度、发起暂停/继续/删除等操作。为了省资源，当某个任务暂停超过 1 分钟，本软件就不再每 3 秒自动刷新进度，改为：收到服务器推送更新时刷新，或你点击右上角「刷新」按钮时手动刷新。<br>
            <b>内部下载</b>：下载改由本软件自己来下载并完全掌控（暂停/继续/删除等），不依赖服务器端执行下载。<br>
            默认推荐使用 <b>Docker 直下</b>。
          </div>
        </el-form-item>

        <el-alert
          v-if="dockerPathWarning"
          type="warning"
          :closable="false"
          show-icon
          style="margin-bottom: 16px"
        >
          <template #title>下载路径可能无法被 Docker 后端访问</template>
          <div style="font-size: 12px; line-height: 1.6">
            当前为 Docker 直下模式，但下载目录是 Windows 本机路径（含盘符或反斜杠）。后端运行在容器内，需要填写容器内可访问的绝对路径（例如 <code>/app/downloads</code>，该路径需已挂载到容器）。
            路径不对会导致文件无法写入、任务卡在"下载中"。
          </div>
        </el-alert>

        <el-form-item label="最大重试次数" required>
          <el-input-number
            v-model="settings.maxRetry"
            :min="0"
            :max="10"
            :step="1"
            style="width: 100%"
          />
          <div class="form-tip">下载分片失败后的重试次数，0 表示不重试</div>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 网络代理 -->
    <el-card class="setting-card" shadow="hover" id="section-proxy">
      <template #header>
        <div class="card-header">
          <el-icon :size="20" color="#9b59b6"><Switch /></el-icon>
          <span>网络代理</span>
        </div>
      </template>

      <el-form :model="settings" label-width="140px">
        <el-form-item label="代理类型">
          <el-radio-group v-model="settings.proxyType">
            <el-radio label="none">无代理</el-radio>
            <el-radio label="http">HTTP 代理</el-radio>
            <el-radio label="socks5">SOCKS5 代理</el-radio>
          </el-radio-group>
        </el-form-item>

        <template v-if="settings.proxyType !== 'none'">
          <el-form-item label="主机地址">
            <el-input v-model="settings.proxyHost" placeholder="例如: 127.0.0.1" />
          </el-form-item>
          <el-form-item label="端口">
            <el-input-number
              v-model="settings.proxyPort"
              :min="1"
              :max="65535"
              :step="1"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="用户名">
            <el-input v-model="settings.proxyUsername" placeholder="可选" />
          </el-form-item>
          <el-form-item label="密码">
            <el-input
              v-model="settings.proxyPassword"
              type="password"
              show-password
              placeholder="可选"
            />
          </el-form-item>
          <el-form-item label="自动回退">
            <el-switch
              v-model="settings.proxyAutoFallback"
              active-text="允许"
              inactive-text="禁止"
            />
            <div class="form-tip">
              代理故障时自动回退到直连模式。关闭后，若代理不可用将无法访问本页面，需手动编辑配置文件修改代理配置。
            </div>
          </el-form-item>
        </template>

        <el-form-item label="运行状态">
          <div class="proxy-status-indicator">
            <el-tag :type="proxyStatusType" size="small">
              {{ proxyStatusText }}
            </el-tag>
          </div>
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            :loading="testingProxy"
            :disabled="settings.proxyType === 'none'"
            @click="testProxyConnection"
          >
            <el-icon><Connection /></el-icon> 测试连接
          </el-button>
        </el-form-item>
      </el-form>

      <div class="form-tip">
        配置代理后，所有网络请求（登录、API 调用、文件下载）将通过代理服务器转发。保存后立即生效，无需重启。
      </div>
    </el-card>

    <!-- 保存按钮 -->
    <div class="save-bar">
      <el-button type="primary" size="large" @click="save">保存设置</el-button>
      <el-button size="large" @click="reset">恢复默认</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Connection,
  Download,
  Lock,
  Folder,
  FolderOpened,
  Switch
} from '@element-plus/icons-vue'
import { useSettingsStore } from '../stores/settings'
import {
  verifyNoAuth,
  loginWithPassword,
  loginWith2FA,
  loginWith2FAOnly
} from '../api/auth'
import { invoke } from '@tauri-apps/api/core'

const settingsStore = useSettingsStore()
const settings = computed(() => settingsStore.config)

const testingServer = ref(false)
const serverStatus = ref<'unknown' | 'online' | 'offline'>('unknown')
const loggingIn = ref(false)
const loginMsg = ref('')
const loginSuccess = ref(false)

const loginForm = reactive({
  password: '',
  totpCode: '',
})

watch(
  () => settingsStore.loaded,
  (loaded) => {
    if (loaded && settingsStore.config.savePassword) {
      loginForm.password = settingsStore.config.password
    }
  },
  { immediate: true }
)

const serverStatusText = computed(
  () =>
    ({ online: '连接正常', offline: '连接失败', unknown: '未测试' }[
      serverStatus.value
    ])
)

const showPassword = computed(
  () => settings.value.authMode === 'password' || settings.value.authMode === 'password_2fa'
)

const show2FA = computed(
  () => settings.value.authMode === '2fa' || settings.value.authMode === 'password_2fa'
)

const proxyStatusType = computed(() => {
  if (settings.value.proxyType === 'none') return 'info'
  if (!settings.value.proxyHost) return 'warning'
  return 'info'
})

const proxyStatusText = computed(() => {
  if (settings.value.proxyType === 'none') return '● 未配置'
  if (!settings.value.proxyHost) return '● 待配置'
  return `● ${settings.value.proxyType}://${settings.value.proxyHost}:${settings.value.proxyPort}`
})

// Docker 直下模式下，若下载目录是 Windows 本机路径，则后端容器无法访问，可能导致任务卡在"下载中"
const dockerPathWarning = computed(() => {
  if (settings.value.downloadMode !== 'docker') return false
  const p = settings.value.defaultDownloadPath || ''
  return /^[a-zA-Z]:[\\/]/.test(p) || /[\\]/.test(p)
})

const onAuthModeChange = () => {
  loginMsg.value = ''
  loginSuccess.value = false
}

const testServerConnection = async () => {
  testingServer.value = true
  try {
    const axios = (await import('axios')).default
    await axios.get(`${settingsStore.baseURL}/`, { timeout: 10000 })
    serverStatus.value = 'online'
    ElMessage.success('连接正常')
  } catch (e: any) {
    serverStatus.value = 'offline'
    ElMessage.error('连接失败: ' + (e.message || '未知错误'))
  } finally {
    testingServer.value = false
  }
}

const handleLogin = async () => {
  loginMsg.value = ''
  loginSuccess.value = false

  if (settings.value.authMode === 'none') {
    try {
      await verifyNoAuth(settingsStore.baseURL)
      settingsStore.config.token = ''
      settingsStore.config.password = ''
      settingsStore.save()
      loginSuccess.value = true
      loginMsg.value = '后端无认证，已设置为无认证模式'
      ElMessage.success('已设置为无认证模式')
    } catch (e: any) {
      loginSuccess.value = false
      loginMsg.value = e.message || '后端已启用认证，无法使用无认证模式'
      ElMessage.error(loginMsg.value)
    }
    return
  }

  if (showPassword.value && !loginForm.password) {
    loginSuccess.value = false
    loginMsg.value = '请输入密码'
    return
  }
  if (show2FA.value && !loginForm.totpCode) {
    loginSuccess.value = false
    loginMsg.value = '请输入 2FA 验证码'
    return
  }

  loggingIn.value = true
  try {
    let result
    if (settings.value.authMode === 'password') {
      result = await loginWithPassword(settingsStore.baseURL, loginForm.password)
    } else if (settings.value.authMode === '2fa') {
      result = await loginWith2FAOnly(settingsStore.baseURL, loginForm.totpCode)
    } else {
      result = await loginWith2FA(
        settingsStore.baseURL,
        loginForm.password,
        loginForm.totpCode
      )
    }

    settingsStore.config.token = result.token
    settingsStore.config.refreshToken = result.refreshToken || ''
    if (settingsStore.config.savePassword) {
      settingsStore.config.password = loginForm.password
    } else {
      settingsStore.config.password = ''
    }
    settingsStore.save()
    loginSuccess.value = true
    if (result.viaFallback) {
      loginMsg.value = '未检测到标准登录接口，已使用密码作为 Token 继续（Fallback 模式）'
      ElMessage.warning(loginMsg.value)
    } else {
      loginMsg.value = '登录成功，Token 已保存'
      ElMessage.success('登录成功')
    }
  } catch (e: any) {
    loginSuccess.value = false
    loginMsg.value = e.message || '登录失败，请检查密码或 2FA 码'
    ElMessage.error(loginMsg.value)
  } finally {
    loggingIn.value = false
  }
}

const handleLogout = () => {
  settingsStore.config.token = ''
  settingsStore.config.refreshToken = ''
  if (!settingsStore.config.savePassword) {
    settingsStore.config.password = ''
    loginForm.password = ''
  }
  settingsStore.save()
  loginMsg.value = ''
  ElMessage.success('已退出登录')
}

const selectDownloadFolder = async () => {
  try {
    const selected = (await invoke('select_folder')) as string
    if (selected) {
      settingsStore.config.defaultDownloadPath = selected
    }
  } catch (e) {
    console.error(e)
  }
}

const testingProxy = ref(false)
const testProxyConnection = async () => {
  if (settings.value.proxyType === 'none') return
  testingProxy.value = true
  try {
    const axios = (await import('axios')).default
    await axios.get(`${settingsStore.baseURL}/`, { timeout: 10000 })
    ElMessage.success('代理测试通过（后端可达）')
  } catch (e: any) {
    ElMessage.error('代理测试失败: ' + (e.message || '未知错误'))
  } finally {
    testingProxy.value = false
  }
}

const save = () => {
  settingsStore.save()
  ElMessage.success('设置已保存')
}

const reset = () => {
  settingsStore.reset()
  loginForm.password = ''
  loginForm.totpCode = ''
  loginMsg.value = ''
  serverStatus.value = 'unknown'
  ElMessage.info('已恢复默认')
}
</script>

<style scoped>
.settings-page {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}
.settings-page h2 {
  font-size: 20px;
  font-weight: 500;
  margin-bottom: 20px;
}

.setting-card {
  margin-bottom: 16px;
}
.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 500;
}

.auth-status-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #f5f7fa;
  border-radius: 8px;
  margin-bottom: 16px;
}
.status-label {
  font-size: 14px;
  color: #606266;
}
.token-hint {
  font-size: 12px;
  color: #909399;
  margin-left: 8px;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.conn-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: 12px;
  font-size: 13px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.dot.online {
  background: #67c23a;
}
.dot.offline {
  background: #f56c6c;
}
.dot.unknown {
  background: #909399;
}

.save-bar {
  margin-top: 24px;
  display: flex;
  gap: 12px;
}

.input-with-button {
  display: flex;
  gap: 8px;
}
.input-with-button .el-input {
  flex: 1;
}

.proxy-status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

code {
  background: #f4f4f5;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
}
</style>
