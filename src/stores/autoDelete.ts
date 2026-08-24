import { ref } from 'vue'

// 记录每个转存任务是否勾选了"下载完成后自动删除网盘转存文件"
// 仅保存 auto_delete = true 的任务，用于下载完成后在客户端侧执行清理
const KEY = 'baidupcs_auto_delete_tasks'
const map = ref<Record<string, boolean>>(load())

function load(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function persist() {
  localStorage.setItem(KEY, JSON.stringify(map.value))
}

/** 标记某任务下载完成后需要清理网盘转存 */
export function markAutoDelete(taskId: string, flag: boolean) {
  if (flag) {
    map.value[taskId] = true
  } else {
    delete map.value[taskId]
  }
  persist()
}

/** 取出并清除某个任务的自动清理标记（仅清理一次） */
export function takeAutoDelete(taskId: string): boolean {
  const v = !!map.value[taskId]
  delete map.value[taskId]
  persist()
  return v
}

/** 获取所有待清理任务 ID 列表 */
export function getAutoDeleteIds(): string[] {
  return Object.keys(map.value)
}
