import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { connectWebSocket } from '../api/websocket'

export interface AppConfig {
  serverUrl: string
  authMode: 'none' | 'password' | '2fa' | 'password_2fa'
  password: string
  totpSecret: string
  token: string
  defaultDownloadPath: string
}

const DEFAULTS: AppConfig = {
  serverUrl: 'http://192.168.0.15:18888',
  authMode: 'password',
  password: '',
  totpSecret: '',
  token: '',
  defaultDownloadPath: './downloads',
}

export const useSettingsStore = defineStore('settings', () => {
  const config = ref<AppConfig>({ ...DEFAULTS })
  const loaded = ref(false)

  const baseURL = computed(() => {
    let url = config.value.serverUrl.trim()
    if (!url) return 'http://192.168.0.15:18888'
    return url.replace(/\/+$/, '')
  })

  const load = () => {
    const raw = localStorage.getItem('baidupcs_settings')
    if (raw) {
      try { config.value = { ...DEFAULTS, ...JSON.parse(raw) } } catch {}
    }
    loaded.value = true
    ensureWsConnected()
  }

  const save = () => {
    localStorage.setItem('baidupcs_settings', JSON.stringify(config.value))
    ensureWsConnected()
  }

  const reset = () => {
    config.value = { ...DEFAULTS }
    localStorage.removeItem('baidupcs_settings')
  }

  const ensureWsConnected = () => {
    connectWebSocket(baseURL.value)
  }

  return { config, loaded, baseURL, load, save, reset, ensureWsConnected }
})
