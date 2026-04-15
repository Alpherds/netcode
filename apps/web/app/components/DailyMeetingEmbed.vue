<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

type DailyCallFrame = {
  on: (event: string, handler: (...args: any[]) => void) => DailyCallFrame
  join: (options: { url: string; token: string }) => Promise<void>
  leave: () => Promise<void>
  destroy: () => Promise<void>
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
let hasJoined = false

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

    callFrame
      .on('joined-meeting', () => {
        loading.value = false
        hasJoined = true
        emit('joined')
      })
      .on('left-meeting', () => {
        emit('closed')
      })
      .on('error', (event: any) => {
        errorMessage.value =
          event?.errorMsg ||
          event?.errorMsg?.msg ||
          event?.message ||
          'Failed to join Daily room'
        loading.value = false
      })

    await callFrame.join({
      url: props.roomUrl,
      token: props.token,
    })

    loading.value = false
  } catch (error: any) {
    errorMessage.value =
      error?.message || 'Failed to initialize Daily meeting'
    loading.value = false
  }
})

onBeforeUnmount(async () => {
  try {
    if (callFrame) {
      if (hasJoined) {
        await callFrame.leave()
      }
      await callFrame.destroy()
    }
  } catch {
    // ignore cleanup errors
  } finally {
    callFrame = null
  }
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