<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

type InteractiveMessage =
  | { type: 'status'; data?: string }
  | { type: 'stdout'; data?: string }
  | { type: 'stderr'; data?: string }
  | { type: 'error'; message?: string }
  | { type: 'exit'; exitCode?: number | null }

const props = defineProps<{
  wsUrl: string
  connectOnMount?: boolean
}>()

const emit = defineEmits<{
  connected: []
  disconnected: []
  status: [value: string]
  exit: [code: number | null]
  error: [message: string]
}>()

const containerRef = ref<HTMLElement | null>(null)

let terminal: Terminal | null = null
let fitAddon: FitAddon | null = null
let ws: WebSocket | null = null
let inputBuffer = ''

const isConnected = ref(false)
const isConnecting = ref(false)

function cleanupSocket() {
  if (ws) {
    try {
      ws.close()
    } catch {}
  }

  ws = null
  isConnected.value = false
  isConnecting.value = false
}

function fitTerminal() {
  try {
    fitAddon?.fit()
  } catch {}
}

function sendInput(text: string) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return

  ws.send(
    JSON.stringify({
      type: 'stdin',
      data: text.endsWith('\n') ? text : `${text}\n`,
    })
  )
}

function connect() {
  if (!props.wsUrl) return
  cleanupSocket()

  if (!terminal) return

  isConnecting.value = true
  inputBuffer = ''
  terminal.clear()

  ws = new WebSocket(props.wsUrl)

  ws.onopen = () => {
    isConnecting.value = false
    isConnected.value = true
    emit('connected')
    emit('status', 'Connected')
  }

  ws.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data) as InteractiveMessage

      if (payload.type === 'status') {
        emit('status', payload.data || 'Connected')
        return
      }

      if (payload.type === 'stdout') {
        terminal?.write(payload.data?.replace(/\n/g, '\r\n') || '')
        return
      }

      if (payload.type === 'stderr') {
        terminal?.write(payload.data?.replace(/\n/g, '\r\n') || '')
        return
      }

      if (payload.type === 'error') {
        const message = payload.message || 'Unknown interactive error'
        emit('status', 'Error')
        emit('error', message)
        terminal?.write(`\r\n[error] ${message}\r\n`)
        return
      }

      if (payload.type === 'exit') {
        emit('status', `Exited (${payload.exitCode ?? '—'})`)
        emit('exit', payload.exitCode ?? null)
        terminal?.write(`\r\n[exit] code=${payload.exitCode ?? '—'}\r\n`)
        isConnected.value = false
        return
      }
    } catch {
      terminal?.write(String(event.data || ''))
    }
  }

  ws.onerror = () => {
    emit('status', 'WebSocket error')
    emit('error', 'Interactive WebSocket connection failed.')
    terminal?.write('\r\n[error] WebSocket connection failed.\r\n')
  }

  ws.onclose = () => {
    emit('status', 'Closed')
    emit('disconnected')
    isConnected.value = false
    isConnecting.value = false
    terminal?.write('\r\n')
  }
}

function disconnect() {
  cleanupSocket()
}

function clearTerminal() {
  terminal?.clear()
  inputBuffer = ''
}

function stopSession() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return

  ws.send(
    JSON.stringify({
      type: 'stop',
    })
  )
}

defineExpose({
  connect,
  disconnect,
  clearTerminal,
  stopSession,
  fitTerminal,
  sendInput,
  get connected() {
    return isConnected.value
  },
})

onMounted(async () => {
  if (!containerRef.value) return

  terminal = new Terminal({
    cursorBlink: true,
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: 13,
    lineHeight: 1.4,
    theme: {
      background: '#0f172a',
      foreground: '#e5e7eb',
      cursor: '#93c5fd',
    },
    convertEol: true,
  })

  fitAddon = new FitAddon()
  terminal.loadAddon(fitAddon)
  terminal.open(containerRef.value)

  await nextTick()
  fitTerminal()

  terminal.onData((data) => {
    if (!terminal) return

    const code = data.charCodeAt(0)

if (code === 13) {
  const value = inputBuffer
  inputBuffer = ''
  terminal.write('\r\n')
  sendInput(value)
  return
}

    if (code === 127) {
      if (inputBuffer.length > 0) {
        inputBuffer = inputBuffer.slice(0, -1)
        terminal.write('\b \b')
      }
      return
    }

    if (code >= 32) {
      inputBuffer += data
      terminal.write(data)
    }
  })

  window.addEventListener('resize', fitTerminal)

  if (props.connectOnMount && props.wsUrl) {
    connect()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', fitTerminal)
  cleanupSocket()
  terminal?.dispose()
  terminal = null
  fitAddon = null
})
</script>

<template>
  <div class="terminal-wrapper">
    <div ref="containerRef" class="terminal-container" />
  </div>
</template>

<style scoped>
.terminal-wrapper {
  width: 100%;
  min-height: 320px;
}

.terminal-container {
  width: 100%;
  height: 320px;
  border-radius: 16px;
  overflow: hidden;
}
</style>