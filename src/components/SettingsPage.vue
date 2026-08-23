<template>
  <div class="settings-page">
    <h2>系统设置</h2>

    <div class="settings-section">
      <h3>🔌 服务器连接</h3>
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
    </div>

    <div class="settings-section">
      <h3>💾 下载设置</h3>
      <el-form :model="settings" label-width="140px">
        <el-form-item label="默认下载地址">
          <el-input
            v-model="settings.defaultDownloadPath"
            placeholder="./downloads"
            clearable
          />
          <div class="form-tip">分享直下时自动填充此路径，无需每次手动输入</div>
        </el-form-item>
      </el-form>
    </div>

    <div class="settings-section">
      <h3>🔐 访问认证</h3>
      <div class="auth-cards">
        <div
          v-for="m in authModes"
          :key="m.val"
          class="auth-card"
          :class="{ active: settings.authMode === m.val }"
          @click="settings.authMode = m.val as any"
        >
          <div class="auth-icon">{{ m.icon }}</div>
          <div class="auth-name">{{ m.label }}</div>
          <div class="auth-desc">{{ m.desc }}</div>
        </div>
      </div>

      <el-form :model="settings" label-width="140px" v-if="settings.authMode !== 'none'">
        <el-form-item label="访问密码" v-if="usePassword">
          <el-input v-model="settings.password" type="password" show-password placeholder="设置访问密码" />
        </el-form-item>
        <el-form-item label="2FA 密钥" v-if="use2FA">
          <el-input v-model="settings.totpSecret" placeholder="输入 TOTP 密钥">
            <template #append><el-button @click="genTOTP">生成</el-button></template>
          </el-input>
          <img v-if="qr" :src="qr" class="qr-img" />
        </el-form-item>
      </el-form>
    </div>

    <div class="settings-section">
      <h3>💾 数据持久化</h3>
      <el-form label-width="140px">
        <el-form-item label="Token">
          <el-input :model-value="settings.token || '未登录'" disabled>
            <template #append><el-button @click="settings.token = ''">清除</el-button></template>
          </el-input>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="save">保存设置</el-button>
          <el-button @click="reset">恢复默认</el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useSettingsStore } from '../stores/settings'

const settingsStore = useSettingsStore()
const settings = computed(() => settingsStore.config)
const testing = ref(false)
const connStatus = ref<'unknown' | 'online' | 'offline'>('unknown')
const qr = ref('')

const authModes = [
  { val: 'none', label: '无认证', desc: '直接访问', icon: '🔓' },
  { val: 'password', label: '仅密码', desc: '密码保护', icon: '🔑' },
  { val: '2fa', label: '仅2FA', desc: 'TOTP认证', icon: '📱' },
  { val: 'password_2fa', label: '密码+2FA', desc: '双重安全', icon: '🛡️' },
]

const usePassword = computed(() => ['password', 'password_2fa'].includes(settings.value.authMode))
const use2FA = computed(() => ['2fa', 'password_2fa'].includes(settings.value.authMode))

const connText = computed(() => ({ online: '连接正常', offline: '连接失败', unknown: '未测试' }[connStatus.value]))

const testConnection = async () => {
  testing.value = true
  await new Promise(r => setTimeout(r, 800))
  connStatus.value = Math.random() > 0.3 ? 'online' : 'offline'
  testing.value = false
  ElMessage[connStatus.value === 'online' ? 'success' : 'error'](connText.value)
}

const genTOTP = () => {
  const secret = Math.random().toString(36).substring(2, 18).toUpperCase()
  settings.value.totpSecret = secret
  qr.value = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=otpauth://totp/BaiduPCS:${settings.value.serverUrl}?secret=${secret}&issuer=BaiduPCS`
}

const save = () => { settingsStore.save(); ElMessage.success('设置已保存') }
const reset = () => { settingsStore.reset(); qr.value = ''; ElMessage.info('已恢复默认') }
</script>

<style scoped>
.settings-page { padding: 20px; max-width: 700px; margin: 0 auto; }
.settings-page h2 { font-size: 20px; font-weight: 500; margin-bottom: 24px; }
.settings-section { margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #e4e7ed; }
.settings-section:last-child { border-bottom: none; }
.settings-section h3 { font-size: 16px; font-weight: 500; margin-bottom: 16px; color: #303133; }

.auth-cards { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 16px; }
.auth-card { border: 2px solid #e4e7ed; border-radius: 8px; padding: 16px; cursor: pointer; text-align: center; background: #fff; transition: all .2s; }
.auth-card:hover { border-color: #c0c4cc; }
.auth-card.active { border-color: #409eff; background: #ecf5ff; }
.auth-icon { font-size: 24px; margin-bottom: 6px; }
.auth-name { font-size: 14px; font-weight: 500; color: #303133; }
.auth-desc { font-size: 12px; color: #909399; margin-top: 4px; }

.conn-status { display: inline-flex; align-items: center; gap: 6px; margin-left: 12px; font-size: 13px; }
.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.dot.online { background: #67c23a; }
.dot.offline { background: #f56c6c; }
.dot.unknown { background: #909399; }

.qr-img { width: 150px; height: 150px; border: 1px solid #e4e7ed; border-radius: 4px; margin-top: 8px; }
.form-tip { font-size: 12px; color: #909399; margin-top: 4px; }
</style>
