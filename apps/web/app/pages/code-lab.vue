
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { definePageMeta, navigateTo, useFetch } from '#imports'
import MonacoCodeEditor from '~/components/code-lab/MonacoCodeEditor.client.vue'

definePageMeta({
  middleware: 'auth',
})

type CodeLabLanguage = {
  id: number
  name: string
  slug: 'cpp' | 'java' | 'python'
  editorLanguage: 'cpp' | 'java' | 'python'
  template: string
}

type RunResponse = {
  ok: boolean
  status_id: number
  status_description: string
  stdout: string
  stderr: string
  compile_output: string
  message: string
  exit_code: number | null
  time: string | number | null
  memory: number | null
}

const {
  data: languages,
  pending: languagesPending,
  error: languagesError,
  refresh: refreshLanguages,
} = await useFetch<CodeLabLanguage[]>('/api/code-lab/languages')

const selectedLanguageId = ref<number | null>(null)
const sourceCode = ref('')
const stdinText = ref('')
const isRunning = ref(false)
const runResult = ref<RunResponse | null>(null)
const runError = ref('')

const safeLanguages = computed(() => languages.value ?? [])

const selectedLanguage = computed(() => {
  return safeLanguages.value.find(
    (item) => item.id === selectedLanguageId.value,
  ) || null
})

watch(
  safeLanguages,
  (items) => {
    if (!items.length) return

    if (!selectedLanguageId.value) {
      selectedLanguageId.value = items[0]!.id
      sourceCode.value = items[0]!.template
      return
    }

    const exists = items.some((item) => item.id === selectedLanguageId.value)
    if (!exists) {
      selectedLanguageId.value = items[0]!.id
      sourceCode.value = items[0]!.template
    }
  },
  { immediate: true },
)

watch(selectedLanguageId, (value, oldValue) => {
  if (!value || value === oldValue) return

  const language = safeLanguages.value.find((item) => item.id === value)
  if (!language) return

  sourceCode.value = language.template
  runResult.value = null
  runError.value = ''
})

const outputText = computed(() => {
  if (runError.value) return runError.value
  if (!runResult.value) return 'Run your program to see output.'

  if (runResult.value.compile_output) return runResult.value.compile_output
  if (runResult.value.stderr) return runResult.value.stderr
  if (runResult.value.stdout) return runResult.value.stdout
  if (runResult.value.message) return runResult.value.message

  return 'Program finished with no output.'
})

const resultColor = computed(() => {
  if (runError.value) return 'error'
  if (!runResult.value) return 'grey'
  if (runResult.value.status_id === 3) return 'success'
  return 'warning'
})

async function goBack() {
  await navigateTo('/')
}

function resetEditorToTemplate() {
  if (!selectedLanguage.value) return
  sourceCode.value = selectedLanguage.value.template
  runResult.value = null
  runError.value = ''
}

async function runCode() {
  runError.value = ''
  runResult.value = null

  if (!selectedLanguageId.value) {
    runError.value = 'Please choose a language.'
    return
  }

  if (!sourceCode.value.trim()) {
    runError.value = 'Source code is required.'
    return
  }

  isRunning.value = true

  try {
    const response = await $fetch<RunResponse>('/api/code-lab/run', {
      method: 'POST',
      body: {
        language_id: selectedLanguageId.value,
        source_code: sourceCode.value,
        stdin: stdinText.value,
      },
    })

    runResult.value = response
  } catch (error: any) {
    runError.value =
      error?.data?.message ||
      error?.statusMessage ||
      'Failed to run code.'
  } finally {
    isRunning.value = false
  }
}
</script>

<template>
  <v-container fluid class="code-lab-page pa-4 pa-md-6">
    <v-card rounded="xl" elevation="4" class="hero-card mb-6">
      <v-card-text class="pa-5 pa-md-7">
        <div class="d-flex justify-space-between align-start flex-wrap ga-4 mb-5">
          <v-btn
            variant="text"
            color="primary"
            rounded="pill"
            prepend-icon="mdi-arrow-left"
            class="back-button"
            @click="goBack"
          >
            Back to Dashboard
          </v-btn>

          <v-chip
            :color="isRunning ? 'success' : 'primary'"
            variant="tonal"
            rounded="pill"
            size="large"
          >
            {{ isRunning ? 'Running Code' : 'Code Lab Ready' }}
          </v-chip>
        </div>

        <div class="d-flex flex-column flex-lg-row justify-space-between align-start ga-6">
          <div class="hero-copy">
            <div class="text-overline text-primary font-weight-bold mb-2">
              Learning Tools / Code Lab
            </div>

            <div class="text-h4 font-weight-bold mb-2">
              Multi-Language Code Lab
            </div>

            <div class="d-flex flex-wrap ga-2 mb-4">
              <v-chip color="primary" variant="outlined" rounded="pill">
                C++
              </v-chip>
              <v-chip color="success" variant="outlined" rounded="pill">
                Java
              </v-chip>
              <v-chip color="indigo" variant="outlined" rounded="pill">
                Python
              </v-chip>
            </div>

            <p class="text-body-1 text-medium-emphasis mb-0">
              This build now uses Monaco for the editor workspace while keeping the same Judge0 execution flow.
            </p>
          </div>

          <div class="hero-action-stack d-flex flex-wrap ga-3 justify-end">
            <v-btn
              color="primary"
              rounded="pill"
              size="large"
              prepend-icon="mdi-play-circle-outline"
              :loading="isRunning"
              @click="runCode"
            >
              Run Code
            </v-btn>

            <v-btn
              color="teal-darken-1"
              rounded="pill"
              size="large"
              prepend-icon="mdi-refresh"
              @click="resetEditorToTemplate"
            >
              Reset Template
            </v-btn>

            <v-btn
              color="grey-darken-2"
              rounded="pill"
              size="large"
              prepend-icon="mdi-refresh-auto"
              :disabled="languagesPending"
              @click="refreshLanguages"
            >
              Refresh Languages
            </v-btn>
          </div>
        </div>

        <v-alert
          v-if="languagesError"
          type="error"
          variant="tonal"
          class="mt-5"
        >
          Failed to load Code Lab languages.
        </v-alert>

        <v-alert
          v-else
          type="info"
          variant="tonal"
          class="mt-5"
        >
          Monaco editor is now active for the coding workspace.
        </v-alert>
      </v-card-text>
    </v-card>

    <v-row dense>
      <v-col cols="12" lg="8">
<v-card rounded="xl" elevation="3" class="section-card mb-6">
  <v-card-text class="pa-5">
    <div class="d-flex flex-column flex-md-row justify-space-between align-start ga-3 mb-4">
      <div>
        <div class="text-h5 font-weight-bold">Editor Workspace</div>
        <div class="text-body-2 text-medium-emphasis">
          Write and run code from the selected language.
        </div>
      </div>

      <v-chip color="primary" variant="tonal" rounded="pill">
        {{ selectedLanguage?.name || 'No language selected' }}
      </v-chip>
    </div>

    <ClientOnly>
      <MonacoCodeEditor
        v-model="sourceCode"
        :language="selectedLanguage?.editorLanguage || 'plaintext'"
        :height="560"
      />

      <template #fallback>
        <v-sheet
          rounded="xl"
          color="#0f172a"
          class="d-flex align-center justify-center"
          style="height: 560px; color: white;"
        >
          Loading editor...
        </v-sheet>
      </template>
    </ClientOnly>
  </v-card-text>
</v-card>

        <v-card rounded="xl" elevation="3" class="section-card">
          <v-card-text class="pa-5">
            <div class="d-flex flex-column flex-md-row justify-space-between align-start ga-3 mb-4">
              <div>
                <div class="text-h5 font-weight-bold">Program Output</div>
                <div class="text-body-2 text-medium-emphasis">
                  Compiler messages, standard output, and errors appear here.
                </div>
              </div>

              <v-chip :color="resultColor" variant="tonal" rounded="pill">
                {{
                  runError
                    ? 'Error'
                    : runResult?.status_description || 'No Result Yet'
                }}
              </v-chip>
            </div>

            <v-sheet rounded="xl" color="#0f172a" class="output-shell pa-4">
              <pre class="output-pre">{{ outputText }}</pre>
            </v-sheet>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" lg="4">
        <v-card rounded="xl" elevation="3" class="section-card mb-6">
          <v-card-text class="pa-5">
            <div class="text-h5 font-weight-bold mb-1">Run Configuration</div>
            <div class="text-body-2 text-medium-emphasis mb-4">
              Choose language and optional input.
            </div>

            <v-select
              v-model="selectedLanguageId"
              label="Language"
              variant="outlined"
              rounded="xl"
              :items="safeLanguages"
              item-title="name"
              item-value="id"
              :loading="languagesPending"
              class="mb-4"
            />

            <v-textarea
              v-model="stdinText"
              label="Program Input (stdin)"
              variant="outlined"
              rounded="xl"
              rows="6"
              auto-grow
              class="mb-4"
            />

            <div class="d-flex flex-column ga-3">
              <v-btn
                block
                color="primary"
                rounded="pill"
                prepend-icon="mdi-play"
                :loading="isRunning"
                @click="runCode"
              >
                Run
              </v-btn>

              <v-btn
                block
                color="grey-darken-2"
                variant="outlined"
                rounded="pill"
                prepend-icon="mdi-refresh"
                @click="resetEditorToTemplate"
              >
                Reset Editor
              </v-btn>
            </div>
          </v-card-text>
        </v-card>

        <v-card rounded="xl" elevation="3" class="section-card">
          <v-card-text class="pa-5">
            <div class="text-h6 font-weight-bold mb-3">Execution Summary</div>

            <div class="d-flex flex-wrap ga-3">
              <v-sheet rounded="xl" color="primary" variant="tonal" class="summary-box pa-4">
                <div class="text-overline">Language</div>
                <div class="text-body-1 font-weight-bold">
                  {{ selectedLanguage?.slug?.toUpperCase() || '—' }}
                </div>
              </v-sheet>

              <v-sheet rounded="xl" color="success" variant="tonal" class="summary-box pa-4">
                <div class="text-overline">Time</div>
                <div class="text-body-1 font-weight-bold">
                  {{ runResult?.time ?? '—' }}
                </div>
              </v-sheet>

              <v-sheet rounded="xl" color="indigo" variant="tonal" class="summary-box pa-4">
                <div class="text-overline">Memory</div>
                <div class="text-body-1 font-weight-bold">
                  {{ runResult?.memory ?? '—' }}
                </div>
              </v-sheet>

              <v-sheet rounded="xl" color="warning" variant="tonal" class="summary-box pa-4">
                <div class="text-overline">Exit Code</div>
                <div class="text-body-1 font-weight-bold">
                  {{ runResult?.exit_code ?? '—' }}
                </div>
              </v-sheet>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.code-lab-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.06), transparent 28%),
    radial-gradient(circle at bottom left, rgba(99, 102, 241, 0.05), transparent 32%),
    #f5f7fb;
}

.hero-card {
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(239, 246, 255, 0.92));
  border: 1px solid rgba(37, 99, 235, 0.08);
}

.section-card {
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: rgba(255, 255, 255, 0.96);
}

.back-button {
  padding-inline: 0;
}

.hero-copy {
  max-width: 760px;
}

.hero-action-stack {
  min-width: 320px;
}

.summary-box {
  min-width: 140px;
}

.output-shell {
  min-height: 280px;
  overflow: auto;
}

.output-pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #e5e7eb;
}

@media (max-width: 960px) {
  .hero-action-stack {
    min-width: unset;
    width: 100%;
    justify-content: stretch;
  }

  .hero-action-stack :deep(.v-btn) {
    flex: 1 1 100%;
  }

  .summary-box {
    min-width: calc(50% - 12px);
  }
}
</style>