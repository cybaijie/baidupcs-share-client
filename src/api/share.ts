import axios, { AxiosInstance } from 'axios'

const BASE_URL = localStorage.getItem('server_url') || 'http://192.168.0.15:18888'

interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

const client: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
})

client.interceptors.response.use(
  (res) => {
    const body = res.data as ApiResponse
    if (body.code !== 0) {
      return Promise.reject(new Error(body.message || '请求失败'))
    }
    return body.data
  },
  (err) => Promise.reject(err)
)

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
    return client.post('/transfers/preview', data)
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
    return client.post('/transfers/preview/dir', data)
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
  }): Promise<TransferResponse> {
    return client.post('/transfers', data)
  },

  listTransfers(): Promise<{ tasks: any[] }> {
    return client.get('/transfers')
  },

  getTransfer(id: string): Promise<any> {
    return client.get(`/transfers/${id}`)
  },

  cancelTransfer(id: string): Promise<any> {
    return client.post(`/transfers/${id}/cancel`)
  },

  deleteTransfer(id: string): Promise<any> {
    return client.delete(`/transfers/${id}`)
  }
}