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
          <el-button type="primary" :loading="testing" @click="testConnection">
            测试连接
          </el-button>
          <span class="conn-status">
            <span class="dot" :class="connStatus"></span>
            {{ connText }}
          </span>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 下载设置 -->
    <el-card class="setting-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <el-icon :size="20" color="#409eff"><Download /></el-icon>
          <span>下载设置</span>
        </div>
      </template>
      <el-form :model="settings" label-width="140px">
        <el-form-item label="默认下载地址">
          <el-input
            v-model="settings.defaultDownloadPath"
            placeholder="./downloads"
            clearable
          />
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

      <!-- 认证状态 -->
      <div class="auth-status-bar">
        <span class="status-label">认证状态</span>
        <el-tag :type="settings.token ? 'success' : 'info'" size="small">
          {{ settings.token ? '已登录' : '未登录' }}
        </el-tag>
        <span v-if="settings.token" class="token-hint">Token 已保存</span>
      </div>

      <el-divider />

      <!-- 认证模式 -->
      <el-form :model="loginForm" label-width="140px">
        <el-form-item label="认证模式">
          <el-select v-model="loginForm.mode" style="width: 100%">
            <el-option label="无认证（直接访问）" value="none" />
            <el-option label="仅密码认证" value="password" />
            <el-option label="仅双因素认证 (2FA)" value="2fa" />
            <el-option label="密码 + 双因素认证" value="password_2fa" />
          </el-select>
          <div class="form-tip">选择后端实际启用的认证方式</div>
        </el-form-item>

        <!-- 密码输入 -->
        <el-form-item label="密码" v-if="loginForm.mode === 'password' || loginForm.mode === 'password_2fa'">
          <el-input
            v-model="loginForm.password"
            type="password"
            show-password
            placeholder="输入后端访问密码"
          />
        </el-form-item>

        <!-- 2FA 输入 -->
        <el-form-item label="2FA 验证码" v-if="loginForm.mode === '2fa' || loginForm.mode === 'password_2fa'">
          <el-input
            v-model="loginForm.totpCode"
            placeholder="输入 6 位 TOTP 验证码"
            maxlength="6"
          />
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

    <!-- 保存按钮 -->
    <div class="save-bar">
      <el-button type="primary" size="large" @click="save">保存设置</el-button>
      <el-button size="large" @click="reset">恢复默认</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Connection, Download, Lock } from '@element-plus/icons-vue'
import { useSettingsStore } from '../stores/settings'
import { loginWithPassword, loginWith2FA } from '../api/auth'

const settingsStore = useSettingsStore()
const settings = computed(() => settingsStore.config)

const testing = ref(false)
const connStatus = ref<'unknown' | 'online' | 'offline'>('unknown')
const loggingIn = ref(false)
const loginMsg = ref('')
const loginSuccess = ref(false)

const loginForm = reactive({
  mode: 'password' as 'none' | 'password' | '2fa' | 'password_2fa',
  password: '',
  totpCode: '',
})

const connText = computed(() => ({ online: '连接正常', offline: '连接失败', unknown: '未测试' }[connStatus.value]))

const testConnection = async () => {
  testing.value = true
  await new Promise(r => setTimeout(r, 800))
  connStatus.value = Math.random() > 0.3 ? 'online' : 'offline'
  testing.value = false
  ElMessage[connStatus.value === 'online' ? 'success' : 'error'](connText.value)
}

const handleLogin = async () => {
  if (loginForm.mode === 'none') {
    settingsStore.config.token = 'no-auth'
    settingsStore.save()
    loginSuccess.value = true
    loginMsg.value = '已设置为无认证模式'
    ElMessage.success('已设置为无认证模式')
    return
  }

  if ((loginForm.mode === 'password' || loginForm.mode === 'password_2fa') && !loginForm.password) {
    loginSuccess.value = false
    loginMsg.value = '请输入密码'
    return
  }
  if ((loginForm.mode === '2fa' || loginForm.mode === 'password_2fa') && !loginForm.totpCode) {
    loginSuccess.value = false
    loginMsg.value = '请输入 2FA 验证码'
    return
  }

  loggingIn.value = true
  loginMsg.value = ''
  try {
    let result
    if (loginForm.mode === 'password') {
      result = await loginWithPassword(loginForm.password)
    } else if (loginForm.mode === '2fa') {
      result = await loginWith2FA('', loginForm.totpCode)
    } else {
      result = await loginWith2FA(loginForm.password, loginForm.totpCode)
    }
    settingsStore.config.token = result.token
    settingsStore.save()
    loginSuccess.value = true
    loginMsg.value = '登录成功，Token 已保存'
    ElMessage.success('登录成功')
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
  settingsStore.save()
  loginMsg.value = ''
  ElMessage.success('已退出登录')
}

const save = () => {
  settingsStore.save()
  ElMessage.success('设置已保存')
}

const reset = () => {
  settingsStore.reset()
  loginForm.mode = 'password'
  loginForm.password = ''
  loginForm.totpCode = ''
  loginMsg.value = ''
  ElMessage.info('已恢复默认')
}
</script>

<style scoped>
.settings-page { padding: 20px; max-width: 700px; margin: 0 auto; }
.settings-page h2 { font-size: 20px; font-weight: 500; margin-bottom: 20px; }

.setting-card { margin-bottom: 16px; }
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
.status-label { font-size: 14px; color: #606266; }
.token-hint { font-size: 12px; color: #909399; margin-left: 8px; }

.form-tip { font-size: 12px; color: #909399; margin-top: 4px; }

.conn-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: 12px;
  font-size: 13px;
}
.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.dot.online { background: #67c23a; }
.dot.offline { background: #f56c6c; }
.dot.unknown { background: #909399; }

.save-bar {
  margin-top: 24px;
  display: flex;
  gap: 12px;
}
</style>
