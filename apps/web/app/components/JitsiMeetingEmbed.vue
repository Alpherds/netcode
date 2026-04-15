<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRuntimeConfig } from '#imports'

type JitsiApi = {
  addListener: (event: string, listener: (...args: any[]) => void) => void
  executeCommand: (command: string, ...args: any[]) => void
  dispose: () => void
}

declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (
      domain: string,
      options: Record<string, unknown>
    ) => JitsiApi
  }
}

const props = defineProps<{
  roomName: string
  displayName?: string
  email?: string
}>()

const emit = defineEmits<{
  joined: []
  closed: []
}>()

const config = useRuntimeConfig()
const jitsiDomain = String(config.public.jitsiDomain || 'meet.jit.si')

const containerRef = ref<HTMLElement | null>(null)
const loadingText = ref('Loading Jitsi script...')
const errorMessage = ref('')
const ready = ref(false)

let api: JitsiApi | null = null
let emittedJoined = false

const applyIdentity = () => {
  const name = props.displayName?.trim() || 'Guest'
  api?.executeCommand('displayName', name)
}

const loadScript = async () => {
  if (window.JitsiMeetExternalAPI) return

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-jitsi-external-api="true"]'
    )

    if (existing) {
      if (window.JitsiMeetExternalAPI) {
        resolve()
        return
      }

      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener(
        'error',
        () => reject(new Error('Failed to load Jitsi external_api.js')),
        { once: true }
      )
      return
    }

    const script = document.createElement('script')
    script.src = `https://${jitsiDomain}/external_api.js`
    script.async = true
    script.dataset.jitsiExternalApi = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Jitsi external_api.js'))
    document.head.appendChild(script)
  })
}

onMounted(async () => {
  try {
    loadingText.value = 'Loading Jitsi script...'
    await loadScript()

    loadingText.value = 'Preparing meeting room...'
    await nextTick()

    if (!window.JitsiMeetExternalAPI) {
      throw new Error('Jitsi API is not available on window')
    }

    if (!containerRef.value) {
      throw new Error('Jitsi container was not mounted')
    }

    api = new window.JitsiMeetExternalAPI(jitsiDomain, {
      roomName: props.roomName,
      parentNode: containerRef.value,
      width: '100%',
      height: '100%',
      userInfo: {
        displayName: props.displayName || 'Guest',
        email: props.email || '',
      },
      configOverwrite: {
        prejoinPageEnabled: false,
        startWithAudioMuted: true,
        startWithVideoMuted: true,
      },
      interfaceConfigOverwrite: {
        DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
      },
    })

    api.addListener('videoConferenceJoined', () => {
      applyIdentity()
      ready.value = true

      if (!emittedJoined) {
        emittedJoined = true
        emit('joined')
      }
    })

    api.addListener('readyToClose', () => {
      emit('closed')
    })

    setTimeout(() => {
      applyIdentity()
      if (!errorMessage.value) {
        ready.value = true
      }
    }, 1200)
  } catch (error: any) {
    errorMessage.value = error?.message || 'Failed to initialize Jitsi meeting'
  }
})

onBeforeUnmount(() => {
  api?.dispose()
  api = null
})
</script>

<template>
  <div class="meeting-shell">
    <div ref="containerRef" class="meeting-frame" />

    <div v-if="!ready && !errorMessage" class="meeting-overlay">
      {{ loadingText }}
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
  min-height: 78vh;
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  overflow: hidden;
  background: #ffffff;
}

.meeting-frame {
  width: 100%;
  min-height: 78vh;
}

.meeting-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(250, 250, 250, 0.9);
  color: #4b5563;
  font-weight: 600;
  text-align: center;
  padding: 24px;
}

.meeting-overlay.error {
  background: #fef2f2;
  color: #b91c1c;
}
</style>