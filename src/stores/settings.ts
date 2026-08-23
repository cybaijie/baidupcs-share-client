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
  savePassword: boolean
  askEveryTime: boolean
  maxRetry: number
  proxyType: 'none' | 'http' | 'socks5'
  proxyHost: string
  proxyPort: number
  proxyUsername: string
  proxyPassword: string
  proxyAutoFallback: boolean
}

const DEFAULTS: AppConfig = {
  serverUrl: 'http://192.168.0.15:18888',
  authMode: 'none',
  password: '',
  totpSecret: '',
  token: '',
  defaultDownloadPath: './downloads',
  savePassword: false,
  askEveryTime: false,
  maxRetry: 3,
  proxyType: 'none',
  proxyHost: '',
  proxyPort: 1080,
  proxyUsername: '',
  proxyPassword: '',
  proxyAutoFallback: true,
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
      try { 
        const parsed = JSON.parse(raw)
        config.value = { ...DEFAULTS, ...parsed } 
      } catch {}
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
