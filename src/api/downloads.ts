import axios from 'axios'
import { useSettingsStore } from '../stores/settings'

function getClient() {
  const store = useSettingsStore()
  return axios.create({
    baseURL: `${store.baseURL}/api/v1`,
    timeout: 30000,
    headers: { 'Content-Type': 'application/json' }
  })
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
