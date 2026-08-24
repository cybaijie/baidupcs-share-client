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

// ==================== Pending Auto Cleanup ====================
const pendingAutoCleanup = new Set<string>()

export function markPendingAutoCleanup(taskId: string) {
  pendingAutoCleanup.add(taskId)
}

export function getPendingAutoCleanup(): string[] {
  return Array.from(pendingAutoCleanup)
}

export function removePendingAutoCleanup(taskId: string) {
  pendingAutoCleanup.delete(taskId)
}

// ==================== Helpers ====================
function extractNameFromPath(path?: string): string {
  if (!path) return ''
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] || ''
}

// ==================== Types ====================

export interface TransferTask {
  id: string
  task_id?: string
  share_url?: string
  status: string
  save_path?: string
  path?: string
  created_at?: string
}

export interface FolderTask {
  id: string
  folder_id?: string
  task_id?: string
  name?: string
  folder_name?: string
  status: string
  path?: string
  folder_path?: string
  save_path?: string
  total_size?: number
  downloaded_size?: number
  total_files?: number
  completed_files?: number
  speed?: number
  download_speed?: number
  sub_tasks?: any[]
  files?: any[]
  task_ids?: string[]
  transfer_id?: string
  source_id?: string
  group_id?: string
  is_folder?: boolean
  type?: string
  created_at?: string
}

export interface FileTask {
  id: string
  task_id?: string
  name?: string
  filename?: string
  status: string
  path?: string
  local_path?: string
  save_path?: string
  total_size?: number
  size?: number
  downloaded_size?: number
  completed_size?: number
  speed?: number
  download_speed?: number
  progress?: number
  group_id?: string
  folder_id?: string
  parent_task_id?: string
  is_folder?: boolean
  type?: string
  created_at?: string
}

// ==================== API ====================

export const downloadApi = {
  // --- List ---
  async getTransfers(): Promise<TransferTask[]> {
    try {
      const r = await getClient().get('/transfers')
      const data = r.data?.data
      const list = data?.tasks || data?.list || data || []
      return list.map((t: any) => ({ ...t, id: String(t.task_id || t.id || '') }))
    } catch { return [] }
  },

  async getFolders(): Promise<FolderTask[]> {
    const endpoints = ['/downloads/folders', '/downloads/all', '/folder-downloads', '/folders/downloads']
    const results: FolderTask[] = []
    for (const ep of endpoints) {
      try {
        const r = await getClient().get(ep)
        const data = r.data?.data
        const list = Array.isArray(data) ? data : (data?.folders || data?.tasks || data?.list || [])
        for (const f of list) {
          if (ep === '/downloads/all' && f.type !== 'folder' && !f.is_folder) continue
          results.push({
            ...f,
            id: String(f.id || f.folder_id || f.task_id || ''),
            name: f.name || f.folder_name || extractNameFromPath(f.path) || extractNameFromPath(f.folder_path) || extractNameFromPath(f.save_path) || 'folder',
            path: f.path || f.folder_path || f.save_path || '',
            status: f.status || 'unknown',
            total_size: f.total_size || f.size || 0,
            downloaded_size: f.downloaded_size || f.completed_size || 0,
            speed: f.speed || f.download_speed || 0,
            total_files: f.total_files || (f.sub_tasks?.length) || (f.files?.length) || 0,
          })
        }
        if (results.length > 0) break
      } catch { continue }
    }
    const map = new Map<string, FolderTask>()
    for (const f of results) {
      if (f.id && !map.has(f.id)) map.set(f.id, f)
    }
    return Array.from(map.values())
  },

  async getFiles(): Promise<FileTask[]> {
    const endpoints = ['/downloads', '/downloads/all', '/downloader/tasks', '/download/tasks']
    const results: FileTask[] = []
    for (const ep of endpoints) {
      try {
        const r = await getClient().get(ep)
        const data = r.data?.data
        const list = Array.isArray(data) ? data : (data?.tasks || data?.downloads || data?.list || [])
        for (const t of list) {
          if (ep === '/downloads/all' && (t.type === 'folder' || t.is_folder)) continue
          results.push({
            ...t,
            id: String(t.id || t.task_id || ''),
            name: t.name || t.filename || extractNameFromPath(t.path) || extractNameFromPath(t.local_path) || extractNameFromPath(t.save_path) || 'file',
            status: t.status || 'unknown',
            total_size: t.total_size || t.size || 0,
            downloaded_size: t.downloaded_size || t.completed_size || 0,
            speed: t.speed || t.download_speed || 0,
          })
        }
        if (results.length > 0) break
      } catch { continue }
    }
    const map = new Map<string, FileTask>()
    for (const f of results) {
      if (f.id && !map.has(f.id)) map.set(f.id, f)
    }
    return Array.from(map.values())
  },

  // --- Folder Control ---
  async pauseFolder(id: string): Promise<boolean> {
    try { await getClient().post(`/downloads/folder/${id}/pause`); return true } catch { return false }
  },
  async resumeFolder(id: string): Promise<boolean> {
    try { await getClient().post(`/downloads/folder/${id}/resume`); return true }
    catch {
      try { await getClient().post(`/downloads/folder/${id}/start`); return true } catch { return false }
    }
  },
  async deleteFolder(id: string): Promise<boolean> {
    const eps = [
      { m: 'delete' as const, u: `/downloads/folder/${id}?delete_files=true` },
      { m: 'delete' as const, u: `/downloads/folder/${id}` },
      { m: 'post' as const, u: `/downloads/folder/${id}/cancel`, d: { delete_files: true } },
    ]
    for (const ep of eps) {
      try {
        if (ep.m === 'delete') await getClient().delete(ep.u)
        else await getClient().post(ep.u, ep.d)
        return true
      } catch { continue }
    }
    return false
  },
  async deleteFolderRecordOnly(id: string): Promise<boolean> {
    const eps = [
      { m: 'delete' as const, u: `/downloads/folder/${id}` },
      { m: 'post' as const, u: `/downloads/folder/${id}/cancel` },
    ]
    for (const ep of eps) {
      try {
        if (ep.m === 'delete') await getClient().delete(ep.u)
        else await getClient().post(ep.u)
        return true
      } catch { continue }
    }
    return false
  },

  // --- File Control ---
  async pauseFile(id: string): Promise<boolean> {
    try { await getClient().post(`/downloads/${id}/pause`); return true } catch { return false }
  },
  async resumeFile(id: string): Promise<boolean> {
    try { await getClient().post(`/downloads/${id}/resume`); return true }
    catch {
      try { await getClient().post(`/downloads/${id}/start`); return true } catch { return false }
    }
  },
  async deleteFile(id: string): Promise<boolean> {
    const eps = [
      { m: 'delete' as const, u: `/downloads/${id}?delete_file=true` },
      { m: 'delete' as const, u: `/downloads/${id}` },
      { m: 'post' as const, u: '/downloads/batch/delete', d: { task_ids: [id], delete_file: true, delete_files: true } },
      { m: 'post' as const, u: `/downloads/${id}/delete`, d: { delete_file: true } },
    ]
    for (const ep of eps) {
      try {
        if (ep.m === 'delete') await getClient().delete(ep.u)
        else await getClient().post(ep.u, ep.d)
        return true
      } catch { continue }
    }
    return false
  },
  async deleteFileRecordOnly(id: string): Promise<boolean> {
    const eps = [
      { m: 'delete' as const, u: `/downloads/${id}` },
      { m: 'post' as const, u: '/downloads/batch/delete', d: { task_ids: [id] } },
      { m: 'post' as const, u: `/downloads/${id}/delete` },
    ]
    for (const ep of eps) {
      try {
        if (ep.m === 'delete') await getClient().delete(ep.u)
        else await getClient().post(ep.u, ep.d)
        return true
      } catch { continue }
    }
    return false
  },

  // --- Transfer Control ---
  async deleteTransfer(id: string): Promise<boolean> {
    try { await getClient().delete(`/transfers/${id}`); return true } catch { return false }
  },

  // --- Netdisk Cleanup ---
  async deleteNetdiskFiles(paths: string[]): Promise<boolean> {
    if (!paths.length) return false
    const payloads = [{ paths }, { path: paths[0] }, { filelist: paths }]
    const endpoints = ['/files/delete', '/file/delete']
    for (const ep of endpoints) {
      for (const payload of payloads) {
        try { await getClient().post(ep, payload); return true } catch { continue }
      }
    }
    return false
  }
}
