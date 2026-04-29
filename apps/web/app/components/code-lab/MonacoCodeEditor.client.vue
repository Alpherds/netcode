<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as monaco from 'monaco-editor'

import 'monaco-editor/min/vs/editor/editor.main.css'

import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

type MonacoLanguage =
  | 'cpp'
  | 'java'
  | 'python'
  | 'javascript'
  | 'typescript'
  | 'json'
  | 'plaintext'

const props = withDefaults(
  defineProps<{
    modelValue: string
    language?: MonacoLanguage
    readOnly?: boolean
    height?: number | string
  }>(),
  {
    language: 'plaintext',
    readOnly: false,
    height: 560,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const containerRef = ref<HTMLElement | null>(null)

let editor: monaco.editor.IStandaloneCodeEditor | null = null
let model: monaco.editor.ITextModel | null = null
let resizeObserver: ResizeObserver | null = null
let suppressEmit = false

const resolvedHeight = computed(() => {
  return typeof props.height === 'number' ? `${props.height}px` : props.height
})

;(self as any).MonacoEnvironment = {
  getWorker(_: unknown, label: string) {
    if (label === 'json') return new jsonWorker()
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker()
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker()
    if (label === 'typescript' || label === 'javascript') return new tsWorker()
    return new editorWorker()
  },
}

function createEditor() {
  if (!containerRef.value) return

  model = monaco.editor.createModel(
    props.modelValue ?? '',
    props.language,
  )

  editor = monaco.editor.create(containerRef.value, {
    model,
    theme: 'vs-dark',
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 14,
    roundedSelection: false,
    scrollBeyondLastLine: false,
    wordWrap: 'on',
    tabSize: 2,
    readOnly: props.readOnly,
    padding: {
      top: 16,
      bottom: 16,
    },
  })

  editor.onDidChangeModelContent(() => {
    if (!editor || suppressEmit) return
    emit('update:modelValue', editor.getValue())
  })

  resizeObserver = new ResizeObserver(() => {
    editor?.layout()
  })

  resizeObserver.observe(containerRef.value)
}

onMounted(async () => {
  await nextTick()
  createEditor()
})

watch(
  () => props.modelValue,
  (value) => {
    if (!editor) return

    const currentValue = editor.getValue()
    if (value === currentValue) return

    suppressEmit = true
    editor.setValue(value ?? '')
    suppressEmit = false
  },
)

watch(
  () => props.language,
  (value) => {
    if (!model || !value) return
    monaco.editor.setModelLanguage(model, value)
  },
)

watch(
  () => props.readOnly,
  (value) => {
    editor?.updateOptions({ readOnly: value })
  },
)

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null

  editor?.dispose()
  editor = null

  model?.dispose()
  model = null
})
</script>

<template>
  <div
    ref="containerRef"
    class="monaco-editor-shell"
    :style="{ height: resolvedHeight }"
  />
</template>

<style scoped>
.monaco-editor-shell {
  display: block;
  width: 100%;
  min-height: 560px;
  border-radius: 20px;
  overflow: hidden;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: #0f172a;
}
</style>