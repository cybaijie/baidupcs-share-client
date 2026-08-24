import axios from 'axios'
import { useSettingsStore } from '../stores/settings'
import { tryRefreshStoredToken } from './auth'

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
    async (error) => {
      const cfg = error.config as (typeof error.config & { _retry?: boolean }) | undefined
      if (error.response?.status === 419) {
        // 自动用 refresh_token 续期后重试一次，避免频繁“认证已过期，请重新登录”
        if (cfg && !cfg._retry) {
          cfg._retry = true
          const ok = await tryRefreshStoredToken()
          if (ok) {
            cfg.headers.Authorization = `Bearer ${useSettingsStore().config.token}`
            return client(cfg)
          }
        }
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

// ==================== Types ====================

export interface TransferTask {
  id: string
  task_id?: string
  share_url?: string
  status: string
  save_path?: string
  path?: string
  created_at?: string
  sub_tasks?: any[]
  download_tasks?: any[]
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

function basenameFromPath(p?: string): string {
  if (!p) return ''
  const clean = p.replace(/[\\/]+$/, '')
  const seg = clean.split(/[\\/]/).pop()
  return seg && seg !== '.' ? seg : ''
}

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
            name: f.name || f.folder_name || 'folder',
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
          const tpath = t.path || t.local_path || t.save_path || ''
          const tname = t.name || t.filename || basenameFromPath(tpath)
          results.push({
            ...t,
            id: String(t.id || t.task_id || ''),
            name: tname || 'file',
            path: tpath,
            local_path: t.local_path || t.save_path || '',
            save_path: t.save_path || t.local_path || '',
            group_id: t.group_id,
            folder_id: t.folder_id,
            parent_task_id: t.parent_task_id,
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

  // --- Transfer Control ---
  async deleteTransfer(id: string): Promise<boolean> {
    if (!id) return false
    const eps = [
      { m: 'delete' as const, u: `/transfers/${id}` },
      { m: 'post' as const, u: `/transfers/${id}/delete`, d: {} },
      { m: 'post' as const, u: `/transfers/${id}/cancel`, d: {} },
      { m: 'delete' as const, u: `/transfers/${id}?force=true` },
    ]
    for (const ep of eps) {
      try {
        if (ep.m === 'delete') await getClient().delete(ep.u)
        else await getClient().post(ep.u, ep.d)
        return true
      } catch (e: any) {
        console.error('删除转存记录失败:', ep.u, e?.response?.status || e?.message || e)
        continue
      }
    }
    return false
  },

  // --- Record removal WITHOUT deleting local files (used by 清除已完成) ---
  async removeFolderRecord(id: string): Promise<boolean> {
    const eps = [
      { m: 'delete' as const, u: `/downloads/folder/${id}` },
      { m: 'delete' as const, u: `/downloads/folders/${id}` },
      { m: 'post' as const, u: `/downloads/folder/${id}/cancel`, d: { delete_files: false } },
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

  async removeFileRecord(id: string): Promise<boolean> {
    const eps = [
      { m: 'delete' as const, u: `/downloads/${id}` },
      { m: 'post' as const, u: '/downloads/batch/delete', d: { task_ids: [id], delete_file: false, delete_files: false } },
      { m: 'post' as const, u: `/downloads/${id}/delete`, d: { delete_file: false } },
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
