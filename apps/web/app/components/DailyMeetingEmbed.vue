<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

type DailyEventHandler = (...args: any[]) => void

type DailyCallFrame = {
  on: (event: string, handler: DailyEventHandler) => DailyCallFrame
  off?: (event: string, handler: DailyEventHandler) => DailyCallFrame
  join: (options: { url: string; token: string }) => Promise<any>
  leave?: () => Promise<any>
  destroy: () => Promise<any>
  isDestroyed?: () => boolean
}

const props = defineProps<{
  roomUrl: string
  token: string
}>()

const emit = defineEmits<{
  joined: []
  closed: []
}>()

const containerRef = ref<HTMLElement | null>(null)
const loading = ref(true)
const errorMessage = ref('')

let callFrame: DailyCallFrame | null = null
let cleanupStarted = false
let joinedOnce = false

const handleJoined: DailyEventHandler = () => {
  if (cleanupStarted) return
  loading.value = false
  joinedOnce = true
  emit('joined')
}

const handleLeft: DailyEventHandler = () => {
  if (cleanupStarted) return
  emit('closed')
}

const handleError: DailyEventHandler = (event: any) => {
  if (cleanupStarted) return

  errorMessage.value =
    event?.errorMsg ||
    event?.errorMsg?.msg ||
    event?.message ||
    'Failed to join Daily room'

  loading.value = false
}

const detachListeners = () => {
  if (!callFrame?.off) return

  try {
    callFrame.off('joined-meeting', handleJoined)
    callFrame.off('left-meeting', handleLeft)
    callFrame.off('error', handleError)
  } catch {
    // ignore listener cleanup issues
  }
}

const safeDestroy = async () => {
  if (!callFrame || cleanupStarted) return

  cleanupStarted = true
  detachListeners()

  try {
    const alreadyDestroyed =
      typeof callFrame.isDestroyed === 'function'
        ? callFrame.isDestroyed()
        : false

    if (!alreadyDestroyed) {
      await callFrame.destroy()
    }
  } catch {
    // swallow destroy-time issues from provider internals
  } finally {
    callFrame = null
  }
}

onMounted(async () => {
  try {
    if (!containerRef.value) {
      throw new Error('Daily container is not ready')
    }

    const dailyModule = await import('@daily-co/daily-js')
    const DailyIframe = dailyModule.default

    callFrame = DailyIframe.createFrame(containerRef.value, {
      iframeStyle: {
        width: '100%',
        height: '100%',
        border: '0',
        borderRadius: '20px',
        backgroundColor: '#0f172a',
      },
      showLeaveButton: true,
    }) as DailyCallFrame

    callFrame.on('joined-meeting', handleJoined)
    callFrame.on('left-meeting', handleLeft)
    callFrame.on('error', handleError)

    await callFrame.join({
      url: props.roomUrl,
      token: props.token,
    })

    if (!cleanupStarted) {
      loading.value = false
    }
  } catch (error: any) {
    if (!cleanupStarted) {
      errorMessage.value =
        error?.message || 'Failed to initialize Daily meeting'
      loading.value = false
    }
  }
})

onBeforeUnmount(async () => {
  await safeDestroy()
})
</script>

<template>
  <div class="meeting-shell">
    <div ref="containerRef" class="meeting-frame" />

    <div v-if="loading && !errorMessage" class="meeting-overlay">
      Loading Daily room...
    </div>

    <div v-if="errorMessage" class="meeting-overlay error">
      {{ errorMessage }}
    </div>
  </div>
</template>

<style scoped>
.meeting-shell {
  position: relative;
  width: 100%;
  height: 760px;
  border: 1px solid #dbe3ee;
  border-radius: 20px;
  overflow: hidden;
  background: #0f172a;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
}

.meeting-frame {
  width: 100%;
  height: 100%;
  background: #0f172a;
}

.meeting-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.78);
  color: #e5e7eb;
  font-weight: 600;
  text-align: center;
  padding: 24px;
}

.meeting-overlay.error {
  background: rgba(127, 29, 29, 0.92);
  color: #fee2e2;
}

@media (max-width: 1280px) {
  .meeting-shell {
    height: 680px;
  }
}

@media (max-width: 1024px) {
  .meeting-shell {
    height: 600px;
  }
}

@media (max-width: 768px) {
  .meeting-shell {
    height: 520px;
    border-radius: 16px;
  }
}
</style>