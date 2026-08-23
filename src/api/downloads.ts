import axios from 'axios'
import { useSettingsStore } from '../stores/settings'

function getClient() {
  const store = useSettingsStore()
  const client = axios.create({
    baseURL: `${store.baseURL}/api/v1`,
    timeout: 30000,
    headers: { 'Content-Type': 'application/json' }
  })

  client.interceptors.request.use((config) => {
    const token = store.config.token
    const authMode = store.config.authMode
    if (token && authMode !== 'none') {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  })

  client.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 419) {
        return Promise.reject(new Error('认证已过期，请重新登录'))
      }
      if (error.response?.status === 401) {
        return Promise.reject(new Error('认证失败，请检查认证设置'))
      }
      return Promise.reject(error)
    }
  )

  return client
}

export interface DownloadTask {
  id: string
  name: string
  is_dir: boolean
  size: number
  progress: number
  status: 'active' | 'waiting' | 'completed' | 'failed'
  speed: string
  created_at: string
  save_path?: string
}

export const downloadApi = {
  list() {
    return getClient().get('/transfers').then(r => r.data.data)
  },
  pause(id: string) {
    return getClient().post(`/transfers/${id}/pause`).then(r => r.data.data)
  },
  resume(id: string) {
    return getClient().post(`/transfers/${id}/resume`).then(r => r.data.data)
  },
  delete(id: string) {
    return getClient().delete(`/transfers/${id}`).then(r => r.data.data)
  }
}
