import { ref } from 'vue'

let ws: WebSocket | null = null
let reconnectTimer: number | null = null
const isConnected = ref(false)

export const wsMessages = ref<any[]>([])

export function connectWebSocket(serverUrl: string) {
  const wsUrl = serverUrl.replace(/^http/, 'ws') + '/api/v1/ws'

  if (ws) {
    ws.close()
  }

  ws = new WebSocket(wsUrl)

  ws.onopen = () => {
    isConnected.value = true
    console.log('[WS] 已连接')
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data)
      wsMessages.value.push(msg)
      if (wsMessages.value.length > 100) {
        wsMessages.value.shift()
      }
    } catch {
      wsMessages.value.push({ type: 'raw', data: event.data })
    }
  }

  ws.onclose = () => {
    isConnected.value = false
    console.log('[WS] 连接关闭，3秒后重连...')
    reconnectTimer = window.setTimeout(() => {
      connectWebSocket(serverUrl)
    }, 3000)
  }

  ws.onerror = (err) => {
    console.error('[WS] 错误:', err)
  }
}

export function disconnectWebSocket() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
  }
  if (ws) {
    ws.close()
    ws = null
  }
}

export function getWsStatus() {
  return isConnected
}