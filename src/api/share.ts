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
      if (error.response?.status === 405) {
        return Promise.reject(new Error('请求方法不允许 (405)，请检查后端API版本'))
      }
      return Promise.reject(error)
    }
  )

  return client
}

interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

export interface ShareFile {
  fs_id: number
  is_dir: boolean
  path: string
  size: number
  name: string
  selected?: boolean
}

export interface ShareInfo {
  short_key: string
  shareid: string
  uk: string
  bdstoken: string
  kind: string
  token?: string
}

export interface PreviewResponse {
  files: ShareFile[]
  share_info: ShareInfo
}

export interface TransferResponse {
  task_id: string
  status: string
  need_password?: boolean
}

export const shareApi = {
  preview(data: { share_url: string; password?: string }): Promise<PreviewResponse> {
    return getClient().post('/transfers/preview', data).then(r => {
      const body = r.data as ApiResponse
      if (body.code !== 0) throw new Error(body.message || '请求失败')
      return body.data
    })
  },

  previewDir(data: {
    short_key: string
    shareid: string
    uk: string
    bdstoken: string
    dir: string
    kind?: string
    token?: string
  }): Promise<PreviewResponse> {
    return getClient().post('/transfers/preview/dir', data).then(r => {
      const body = r.data as ApiResponse
      if (body.code !== 0) throw new Error(body.message || '请求失败')
      return body.data
    })
  },

  createTransfer(data: {
    share_url: string
    password?: string
    save_path: string
    save_fs_id?: number
    auto_download?: boolean
    local_download_path?: string
    is_share_direct_download?: boolean
    selected_fs_ids?: number[]
    auto_delete?: boolean
    // 选中子文件夹内文件转存时，后端需要源目录与分享鉴权信息来解析 fs_id
    dir?: string
    short_key?: string
    shareid?: string
    uk?: string
    bdstoken?: string
    kind?: string
    token?: string
  }): Promise<TransferResponse> {
    return getClient().post('/transfers', data).then(r => {
      const body = r.data as ApiResponse
      if (body.code !== 0) throw new Error(body.message || '请求失败')
      return body.data
    })
  },

  listTransfers(): Promise<{ tasks: any[] }> {
    return getClient().get('/transfers').then(r => {
      const body = r.data as ApiResponse
      if (body.code !== 0) throw new Error(body.message || '请求失败')
      return body.data
    })
  },

  getTransfer(id: string): Promise<any> {
    return getClient().get(`/transfers/${id}`).then(r => r.data.data)
  },

  cancelTransfer(id: string): Promise<any> {
    return getClient().post(`/transfers/${id}/cancel`).then(r => r.data.data)
  },

  deleteTransfer(id: string): Promise<any> {
    return getClient().delete(`/transfers/${id}`).then(r => r.data.data)
  }
}
