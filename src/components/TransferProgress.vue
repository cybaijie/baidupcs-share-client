<template>
  <div class="transfer-progress">
    <el-result
      icon="success"
      title="下载任务已创建"
      :sub-title="`任务ID: ${taskId}`"
    >
      <template #extra>
        <el-button type="primary" @click="emit('close')">新建任务</el-button>
        <el-button @click="openWebUI">在网页中查看</el-button>
      </template>
    </el-result>

    <div v-if="latestMessage" class="ws-status">
      <el-divider>实时状态</el-divider>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="类型">{{ latestMessage.type }}</el-descriptions-item>
        <el-descriptions-item label="时间">{{ formatTime(latestMessage.time) }}</el-descriptions-item>
      </el-descriptions>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { wsMessages } from '../api/websocket'

const props = defineProps<{ taskId: string }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const latestMessage = computed(() => {
  const msgs = wsMessages.value.filter(m => m.task_id === props.taskId || m.type?.includes('transfer'))
  return msgs.length > 0 ? msgs[msgs.length - 1] : null
})

const openWebUI = () => {
  const serverUrl = localStorage.getItem('server_url') || 'http://192.168.0.15:18888'
  window.open(`${serverUrl}/#/transfers`, '_blank')
}

const formatTime = (t?: number) => {
  if (!t) return '-'
  return new Date(t).toLocaleString()
}
</script>