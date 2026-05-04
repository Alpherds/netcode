<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { definePageMeta, navigateTo, useFetch } from '#imports'
import MonacoCodeEditor from '~/components/code-lab/MonacoCodeEditor.client.vue'
import InteractiveTerminal from '~/components/code-lab/InteractiveTerminal.client.vue'
import { useCodeProjects } from '~/composables/useCodeProjects'
import { useInteractiveRunner } from '~/composables/useInteractiveRunner'
import type { CodeProjectDto, SaveCodeProjectInput } from '~/types/code-project'

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
} = await useFetch<CodeLabLanguage[]>('/api/code-lab/languages')

const selectedLanguageId = ref<number | null>(null)
const sourceCode = ref('')
const stdinText = ref('')
const isRunning = ref(false)
const runResult = ref<RunResponse | null>(null)
const runError = ref('')

const codeProjectsApi = useCodeProjects()
const interactiveApi = useInteractiveRunner()

const projectTitle = ref('Untitled Code')
const currentProjectDocumentId = ref('')
const savedProjectsDialog = ref(false)
const savedProjects = ref<CodeProjectDto[]>([])
const savedProjectsLoading = ref(false)
const saveLoading = ref(false)
const deleteLoading = ref(false)
const autosaveRunLoading = ref(false)

const feedbackOpen = ref(false)
const feedbackMessage = ref('')
const feedbackColor = ref<'success' | 'error' | 'warning' | 'info'>('success')

const interactiveSessionId = ref('')
const interactiveWsUrl = ref('')
const interactiveRunning = ref(false)
const interactiveConnecting = ref(false)
const interactiveStatus = ref('Idle')
const interactiveMode = ref(false)

const applyingLoadedProject = ref(false)
const terminalRef = ref<InstanceType<typeof InteractiveTerminal> | null>(null)

const safeLanguages = computed(() => languages.value ?? [])

const selectedLanguage = computed(() => {
  return (
    safeLanguages.value.find((item) => item.id === selectedLanguageId.value) ||
    null
  )
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
  { immediate: true }
)

watch(selectedLanguageId, (value, oldValue) => {
  if (!value || value === oldValue) return

  const language = safeLanguages.value.find((item) => item.id === value)
  if (!language) return

  if (applyingLoadedProject.value) return

  sourceCode.value = language.template
  runResult.value = null
  runError.value = ''
  interactiveMode.value = false
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

function showFeedback(
  message: string,
  color: 'success' | 'error' | 'warning' | 'info' = 'success'
) {
  feedbackMessage.value = message
  feedbackColor.value = color
  feedbackOpen.value = true
}

async function goBack() {
  await navigateTo('/')
}

function resetEditorToTemplate() {
  if (!selectedLanguage.value) return
  sourceCode.value = selectedLanguage.value.template
  runResult.value = null
  runError.value = ''
  interactiveMode.value = false
  terminalRef.value?.disconnect()
  terminalRef.value?.clearTerminal()
}

function buildProjectPayload(): SaveCodeProjectInput {
  const language = selectedLanguage.value?.slug

  if (!language) {
    throw new Error('Please choose a language first.')
  }

  return {
    title: projectTitle.value.trim() || 'Untitled Code',
    language,
    sourceCode: sourceCode.value,
    stdin: stdinText.value,
    latestStdout: runResult.value?.stdout || '',
    latestStderr: runResult.value?.stderr || '',
    latestCompileOutput: runResult.value?.compile_output || '',
    latestMessage: runResult.value?.message || '',
    latestStatus: runResult.value?.status_description || '',
    latestTime: runResult.value?.time ? String(runResult.value.time) : '',
    latestMemory: runResult.value?.memory ?? null,
    latestExitCode: runResult.value?.exit_code ?? null,
    isSubmitted: false,
    exerciseKey: '',
  }
}

async function fetchSavedProjects() {
  savedProjectsLoading.value = true
  try {
    const response = await codeProjectsApi.list()
    savedProjects.value = response.items
  } catch (error: any) {
    console.error('fetchSavedProjects error:', error)
    showFeedback(
      error?.data?.message ||
        error?.message ||
        'Failed to load saved projects.',
      'error'
    )
  } finally {
    savedProjectsLoading.value = false
  }
}

async function openSavedProjects() {
  savedProjectsDialog.value = true
  await fetchSavedProjects()
}

async function saveProject() {
  try {
    const payload = buildProjectPayload()

    saveLoading.value = true

    if (currentProjectDocumentId.value) {
      const response = await codeProjectsApi.update(
        currentProjectDocumentId.value,
        payload
      )

      savedProjects.value = savedProjects.value.map((item: CodeProjectDto) =>
        item.documentId === response.item.documentId ? response.item : item
      )
    } else {
      const response = await codeProjectsApi.create(payload)
      currentProjectDocumentId.value = response.item.documentId
      projectTitle.value = response.item.title
      savedProjects.value = [response.item, ...savedProjects.value]
    }

    await fetchSavedProjects()
    showFeedback('Code project saved successfully.', 'success')
  } catch (error: any) {
    console.error('saveProject error:', error)
    showFeedback(
      error?.data?.message || error?.message || 'Failed to save project.',
      'error'
    )
  } finally {
    saveLoading.value = false
  }
}

async function autosaveCurrentRunResult() {
  if (!currentProjectDocumentId.value) return

  try {
    autosaveRunLoading.value = true

    const payload = buildProjectPayload()
    const response = await codeProjectsApi.update(
      currentProjectDocumentId.value,
      payload
    )

    projectTitle.value = response.item.title

    savedProjects.value = savedProjects.value.map((item: CodeProjectDto) =>
      item.documentId === response.item.documentId ? response.item : item
    )
  } catch (error: any) {
    console.error('autosaveCurrentRunResult error:', error)

    showFeedback(
      error?.data?.message ||
        error?.message ||
        'Run finished, but autosaving the result failed.',
      'warning'
    )
  } finally {
    autosaveRunLoading.value = false
  }
}

async function runCode() {
  runError.value = ''
  runResult.value = null
  interactiveMode.value = false

  terminalRef.value?.disconnect()
  terminalRef.value?.clearTerminal()

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
    await autosaveCurrentRunResult()
  } catch (error: any) {
    runError.value =
      error?.data?.message ||
      error?.statusMessage ||
      'Failed to run code.'
  } finally {
    isRunning.value = false
  }
}

function getInteractiveLanguage(): 'python' | null {
  const slug = selectedLanguage.value?.slug

  if (slug === 'python') return 'python'

  return null
}

function resetInteractiveState() {
  interactiveSessionId.value = ''
  interactiveWsUrl.value = ''
  interactiveRunning.value = false
  interactiveConnecting.value = false
  interactiveStatus.value = 'Idle'
}

async function startInteractiveRun() {
  try {
    const language = getInteractiveLanguage()

    if (!language) {
      showFeedback(
        'Interactive mode currently supports Python only.',
        'warning'
      )
      return
    }

    if (!sourceCode.value.trim()) {
      showFeedback('Source code is required.', 'warning')
      return
    }

    terminalRef.value?.disconnect()
    resetInteractiveState()

    interactiveConnecting.value = true
    interactiveStatus.value = 'Creating session...'
    runResult.value = null
    runError.value = ''

    const response = await interactiveApi.createSession({
      language,
      sourceCode: sourceCode.value,
    })

    interactiveMode.value = true
    interactiveSessionId.value = response.sessionId
    interactiveWsUrl.value = response.wsUrl
    interactiveStatus.value = 'Connecting...'

    await nextTick()
    terminalRef.value?.clearTerminal()
    terminalRef.value?.connect()
  } catch (error: any) {
    console.error('startInteractiveRun error:', error)

    terminalRef.value?.disconnect()
    resetInteractiveState()
    interactiveMode.value = false

    showFeedback(
      error?.data?.message ||
        error?.message ||
        'Failed to start interactive session.',
      'error'
    )
  }
}

async function stopInteractiveRun() {
  try {
    if (!interactiveSessionId.value) {
      resetInteractiveState()
      terminalRef.value?.disconnect()
      return
    }

    await interactiveApi.stopSession(interactiveSessionId.value)
    interactiveStatus.value = 'Stopping...'
  } catch (error: any) {
    console.error('stopInteractiveRun error:', error)

    showFeedback(
      error?.data?.message ||
        error?.message ||
        'Failed to stop interactive session.',
      'error'
    )
  }
}

function createNewProject() {
  terminalRef.value?.disconnect()
  terminalRef.value?.clearTerminal()
  resetInteractiveState()

  currentProjectDocumentId.value = ''
  projectTitle.value = 'Untitled Code'
  stdinText.value = ''
  interactiveMode.value = false
  resetEditorToTemplate()
}

function loadProject(item: CodeProjectDto) {
  terminalRef.value?.disconnect()
  terminalRef.value?.clearTerminal()
  resetInteractiveState()

  currentProjectDocumentId.value = item.documentId
  projectTitle.value = item.title
  stdinText.value = item.stdin || ''
  runResult.value = null
  runError.value = ''
  interactiveMode.value = false

  const matchedLanguage = safeLanguages.value.find(
    (lang) => lang.slug === item.language
  )

  applyingLoadedProject.value = true

  if (matchedLanguage) {
    selectedLanguageId.value = matchedLanguage.id
  }

  sourceCode.value = item.sourceCode

  setTimeout(() => {
    applyingLoadedProject.value = false
  }, 0)

  savedProjectsDialog.value = false
}

async function deleteProjectFromList(item: CodeProjectDto) {
  const confirmed = window.confirm(`Delete "${item.title}"?`)
  if (!confirmed) return

  try {
    deleteLoading.value = true
    await codeProjectsApi.remove(item.documentId)

    savedProjects.value = savedProjects.value.filter(
      (project: CodeProjectDto) => project.documentId !== item.documentId
    )

    if (currentProjectDocumentId.value === item.documentId) {
      createNewProject()
    }

    showFeedback('Code project deleted.', 'success')
  } catch (error: any) {
    console.error('deleteProjectFromList error:', error)
    showFeedback(
      error?.data?.message || error?.message || 'Failed to delete project.',
      'error'
    )
  } finally {
    deleteLoading.value = false
  }
}

async function deleteCurrentProject() {
  if (!currentProjectDocumentId.value) {
    showFeedback('No saved project selected.', 'warning')
    return
  }

  const target = savedProjects.value.find(
    (item: CodeProjectDto) =>
      item.documentId === currentProjectDocumentId.value
  )

  const confirmed = window.confirm(
    `Delete "${target?.title || projectTitle.value}"?`
  )
  if (!confirmed) return

  try {
    deleteLoading.value = true
    await codeProjectsApi.remove(currentProjectDocumentId.value)

    savedProjects.value = savedProjects.value.filter(
      (item: CodeProjectDto) =>
        item.documentId !== currentProjectDocumentId.value
    )

    createNewProject()
    showFeedback('Code project deleted.', 'success')
  } catch (error: any) {
    console.error('deleteCurrentProject error:', error)
    showFeedback(
      error?.data?.message || error?.message || 'Failed to delete project.',
      'error'
    )
  } finally {
    deleteLoading.value = false
  }
}

function onTerminalConnected() {
  interactiveConnecting.value = false
  interactiveRunning.value = true
  interactiveStatus.value = 'Connected'
}

function onTerminalDisconnected() {
  interactiveRunning.value = false
  interactiveConnecting.value = false
  interactiveStatus.value = 'Closed'
}

function onTerminalStatus(value: string) {
  interactiveStatus.value = value
}

function onTerminalExit(code: number | null) {
  interactiveRunning.value = false
  interactiveConnecting.value = false
  interactiveStatus.value = `Exited (${code ?? '—'})`
}

function onTerminalError(message: string) {
  interactiveRunning.value = false
  interactiveConnecting.value = false
  interactiveStatus.value = 'Error'
  showFeedback(message, 'error')
}

onBeforeUnmount(() => {
  terminalRef.value?.disconnect()
})
</script>

<template>
  <v-container fluid class="code-lab-page premium-shell pa-4 pa-md-6">
    <v-card rounded="xl" elevation="0" class="hero-card premium-hero mb-6">
      <v-card-text class="pa-5 pa-md-7">
        <div
          class="d-flex justify-space-between align-start flex-wrap ga-4 mb-5"
        >
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
            Use the editor on the left and the program console on the right.
            Batch run and interactive terminal mode are both available from the
            editor toolbar.
          </p>
        </div>

        <v-alert
          v-if="languagesError"
          type="error"
          variant="tonal"
          class="mt-5"
        >
          Failed to load Code Lab languages.
        </v-alert>

        <v-alert v-else type="info" variant="tonal" class="mt-5">
          Monaco editor is now active for the coding workspace.
        </v-alert>
      </v-card-text>
    </v-card>

    <v-row dense align="stretch" class="workspace-grid">
      <v-col cols="12" lg="8">
        <v-card rounded="xl" elevation="0" class="section-card premium-card editor-card h-100">
          <v-card-text class="pa-5">
            <div
              class="d-flex flex-column flex-md-row justify-space-between align-start ga-3 mb-4"
            >
              <div>
                <div class="text-h5 font-weight-bold">Editor Workspace</div>
                <div class="text-body-2 text-medium-emphasis">
                  Write and manage your code here.
                </div>
              </div>
            </div>

            <v-row dense class="toolbar-shell mt-2 mb-4">
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="projectTitle"
                  label="Project Title"
                  variant="outlined"
                  density="comfortable"
                  prepend-inner-icon="mdi-file-document-edit-outline"
                  hide-details
                />
              </v-col>

              <v-col cols="12" md="3">
                <v-select
                  v-model="selectedLanguageId"
                  label="Language"
                  variant="outlined"
                  density="comfortable"
                  hide-details
                  :items="safeLanguages"
                  item-title="name"
                  item-value="id"
                  :loading="languagesPending"
                />
              </v-col>

              <v-col
                cols="12"
                md="5"
                class="d-flex flex-wrap justify-end ga-2 toolbar-actions"
              >
                <v-btn
                  color="primary"
                  prepend-icon="mdi-play"
                  :loading="isRunning"
                  @click="runCode"
                >
                  Run
                </v-btn>

                <v-btn
                  color="deep-purple-darken-1"
                  prepend-icon="mdi-console"
                  :loading="interactiveConnecting"
                  @click="startInteractiveRun"
                >
                  Interactive Run
                </v-btn>

                <v-btn
                  variant="outlined"
                  prepend-icon="mdi-file-plus-outline"
                  @click="createNewProject"
                >
                  New
                </v-btn>

                <v-btn
                  color="primary"
                  :loading="saveLoading || autosaveRunLoading"
                  prepend-icon="mdi-content-save-outline"
                  @click="saveProject"
                >
                  Save
                </v-btn>

                <v-btn
                  variant="outlined"
                  prepend-icon="mdi-folder-open-outline"
                  :loading="savedProjectsLoading"
                  @click="openSavedProjects"
                >
                  My Saved Codes
                </v-btn>

                <v-btn
                  variant="outlined"
                  prepend-icon="mdi-refresh"
                  @click="resetEditorToTemplate"
                >
                  Reset
                </v-btn>

                <v-btn
                  color="error"
                  variant="tonal"
                  prepend-icon="mdi-delete-outline"
                  :disabled="!currentProjectDocumentId"
                  :loading="deleteLoading"
                  @click="deleteCurrentProject"
                >
                  Delete
                </v-btn>
              </v-col>
            </v-row>

            <ClientOnly>
              <MonacoCodeEditor
                v-model="sourceCode"
                :language="selectedLanguage?.editorLanguage || 'plaintext'"
                :height="620"
              />

              <template #fallback>
                <v-sheet
                  rounded="xl"
                  color="#0f172a"
                  class="d-flex align-center justify-center"
                  style="height: 620px; color: white"
                >
                  Loading editor...
                </v-sheet>
              </template>
            </ClientOnly>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" lg="4">
        <v-card rounded="xl" elevation="0" class="section-card premium-card console-card h-100">
          <v-card-text class="pa-5 d-flex flex-column fill-height">
            <div
              class="d-flex flex-column flex-md-row justify-space-between align-start ga-3 mb-4"
            >
              <div>
                <div class="text-h5 font-weight-bold">Program Console</div>
                <div class="text-body-2 text-medium-emphasis">
                  Batch output and interactive terminal output appear here.
                </div>
              </div>

              <div class="d-flex flex-wrap ga-2">
                <v-chip
                  :color="
                    interactiveMode
                      ? interactiveRunning
                        ? 'success'
                        : interactiveConnecting
                          ? 'warning'
                          : 'deep-purple'
                      : resultColor
                  "
                  variant="tonal"
                  rounded="pill"
                >
                  {{
                    interactiveMode
                      ? interactiveStatus
                      : runError
                        ? 'Error'
                        : runResult?.status_description || 'Idle'
                  }}
                </v-chip>

                <v-chip
                  v-if="interactiveMode"
                  color="deep-purple-darken-1"
                  variant="outlined"
                  rounded="pill"
                >
                  Interactive Mode
                </v-chip>
              </div>
            </div>

            <div class="console-body flex-grow-1">
              <div v-if="!interactiveMode" class="h-100">
                <v-sheet rounded="xl" color="#0f172a" class="output-shell premium-console-shell pa-4 h-100">
                  <pre class="output-pre">{{ outputText }}</pre>
                </v-sheet>
              </div>

              <div v-else class="console-terminal h-100">
                <ClientOnly>
                  <InteractiveTerminal
                    ref="terminalRef"
                    :ws-url="interactiveWsUrl"
                    :connect-on-mount="false"
                    @connected="onTerminalConnected"
                    @disconnected="onTerminalDisconnected"
                    @status="onTerminalStatus"
                    @exit="onTerminalExit"
                    @error="onTerminalError"
                  />

                  <template #fallback>
                    <v-sheet
                      rounded="xl"
                      color="#0f172a"
                      class="d-flex align-center justify-center h-100"
                      style="min-height: 620px; color: white"
                    >
                      Loading interactive terminal...
                    </v-sheet>
                  </template>
                </ClientOnly>
              </div>
            </div>

            <div
              v-if="interactiveMode"
              class="d-flex flex-column flex-md-row ga-3 mt-4"
            >
              <v-btn
                color="error"
                variant="outlined"
                rounded="pill"
                prepend-icon="mdi-stop-circle-outline"
                :disabled="!interactiveRunning && !interactiveConnecting"
                @click="stopInteractiveRun"
              >
                Stop Session
              </v-btn>

              <v-btn
                color="grey-darken-2"
                variant="outlined"
                rounded="pill"
                prepend-icon="mdi-broom"
                @click="terminalRef?.clearTerminal()"
              >
                Clear Terminal
              </v-btn>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-dialog v-model="savedProjectsDialog" max-width="900">
      <v-card rounded="xl">
        <v-card-title class="text-h6 font-weight-bold">
          My Saved Codes
        </v-card-title>

        <v-card-text>
          <v-alert
            v-if="!savedProjectsLoading && savedProjects.length === 0"
            type="info"
            variant="tonal"
            class="mb-4"
          >
            No saved code projects yet.
          </v-alert>

          <div v-if="savedProjectsLoading" class="py-6 text-center">
            Loading saved projects...
          </div>

          <v-list v-else>
            <v-list-item
              v-for="item in savedProjects"
              :key="item.documentId"
              class="mb-2 rounded-lg border"
            >
              <v-list-item-title class="font-weight-bold">
                {{ item.title }}
              </v-list-item-title>

              <v-list-item-subtitle>
                {{ item.language.toUpperCase() }} • Updated:
                {{
                  item.updatedAt
                    ? new Date(item.updatedAt).toLocaleString()
                    : '—'
                }}
              </v-list-item-subtitle>

              <template #append>
                <div class="d-flex ga-2">
                  <v-btn
                    size="small"
                    color="primary"
                    variant="flat"
                    @click="loadProject(item)"
                  >
                    Open
                  </v-btn>

                  <v-btn
                    size="small"
                    color="error"
                    variant="tonal"
                    @click="deleteProjectFromList(item)"
                  >
                    Delete
                  </v-btn>
                </div>
              </template>
            </v-list-item>
          </v-list>
        </v-card-text>

        <v-card-actions class="justify-end">
          <v-btn variant="text" @click="savedProjectsDialog = false">
            Close
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar
      v-model="feedbackOpen"
      :color="feedbackColor"
      timeout="2500"
      location="top right"
      rounded="pill"
    >
      {{ feedbackMessage }}

      <template #actions>
        <v-btn variant="text" color="white" @click="feedbackOpen = false">
          Close
        </v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<style scoped>
.code-lab-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at top left, rgba(59, 130, 246, 0.10), transparent 26%),
    radial-gradient(circle at top right, rgba(139, 92, 246, 0.10), transparent 24%),
    radial-gradient(circle at bottom left, rgba(16, 185, 129, 0.08), transparent 22%),
    linear-gradient(180deg, #f8fbff 0%, #f3f6fb 45%, #eef3f9 100%);
}

.premium-shell {
  position: relative;
}

.hero-card {
  overflow: hidden;
  position: relative;
  border-radius: 28px !important;
}

.premium-hero {
  background:
    linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(245,248,255,0.96) 45%, rgba(237,242,255,0.96) 100%);
  border: 1px solid rgba(148, 163, 184, 0.16);
  box-shadow:
    0 10px 30px rgba(15, 23, 42, 0.06),
    0 1px 0 rgba(255,255,255,0.8) inset;
}

.premium-hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 85% 18%, rgba(59, 130, 246, 0.12), transparent 20%),
    radial-gradient(circle at 72% 22%, rgba(139, 92, 246, 0.10), transparent 18%);
  pointer-events: none;
}

.section-card {
  position: relative;
  border-radius: 26px !important;
  background: rgba(255,255,255,0.84);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(148, 163, 184, 0.14);
  box-shadow:
    0 12px 28px rgba(15, 23, 42, 0.06),
    0 1px 0 rgba(255,255,255,0.9) inset;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease;
}

.section-card:hover {
  transform: translateY(-2px);
  box-shadow:
    0 18px 38px rgba(15, 23, 42, 0.09),
    0 1px 0 rgba(255,255,255,0.92) inset;
  border-color: rgba(99, 102, 241, 0.18);
}

.editor-card::before,
.console-card::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 4px;
  border-radius: 26px 26px 0 0;
}

.editor-card::before {
  background: linear-gradient(90deg, #2563eb, #7c3aed);
}

.console-card::before {
  background: linear-gradient(90deg, #7c3aed, #0ea5e9);
}

.back-button {
  padding-inline: 0;
  font-weight: 600;
}

.hero-copy {
  max-width: 900px;
  position: relative;
  z-index: 1;
}

.hero-copy .text-h4 {
  letter-spacing: -0.03em;
  line-height: 1.05;
}

.hero-copy .text-body-1 {
  max-width: 760px;
  line-height: 1.7;
}

.workspace-grid {
  gap: 6px 0;
}

.toolbar-shell {
  margin-inline: 0;
  padding: 12px;
  border-radius: 22px;
  background:
    linear-gradient(180deg, rgba(248,250,252,0.92), rgba(241,245,249,0.82));
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow:
    0 8px 18px rgba(15, 23, 42, 0.04),
    0 1px 0 rgba(255,255,255,0.85) inset;
}

.toolbar-actions :deep(.v-btn) {
  border-radius: 14px !important;
  text-transform: none;
  font-weight: 600;
  letter-spacing: 0;
  min-height: 38px;
  box-shadow: none;
}

.toolbar-actions :deep(.v-btn--variant-outlined) {
  border-color: rgba(100, 116, 139, 0.24);
  background: rgba(255,255,255,0.66);
}

.toolbar-actions :deep(.v-btn:hover) {
  transform: translateY(-1px);
}

.console-body {
  min-height: 620px;
}

.output-shell {
  min-height: 620px;
  overflow: auto;
  border: 1px solid rgba(99, 102, 241, 0.14);
}

.premium-console-shell {
  background:
    radial-gradient(circle at top left, rgba(37, 99, 235, 0.08), transparent 24%),
    linear-gradient(180deg, #07142f 0%, #081630 45%, #08152b 100%) !important;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.03),
    inset 0 0 0 1px rgba(255,255,255,0.02);
}

.output-pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family:
    ui-monospace,
    SFMono-Regular,
    Menlo,
    Monaco,
    Consolas,
    monospace;
  font-size: 13px;
  line-height: 1.65;
  color: #e5e7eb;
}

.console-terminal :deep(.terminal-wrapper) {
  min-height: 620px;
}

.console-terminal :deep(.terminal-container) {
  height: 620px;
  width: 100%;
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid rgba(99, 102, 241, 0.14);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.03),
    inset 0 0 0 1px rgba(255,255,255,0.02);
}

.console-terminal :deep(.xterm) {
  padding: 14px 12px;
}

:deep(.v-field) {
  border-radius: 16px !important;
}

:deep(.v-field--variant-outlined .v-field__outline) {
  --v-field-border-opacity: 0.22;
}

:deep(.v-chip) {
  font-weight: 600;
  letter-spacing: 0;
}

:deep(.v-alert) {
  border-radius: 18px !important;
  border: 1px solid rgba(148, 163, 184, 0.14);
}

:deep(.v-list-item) {
  border: 1px solid rgba(148, 163, 184, 0.14);
  background: rgba(255,255,255,0.74);
}

:deep(.v-list-item:hover) {
  background: rgba(248,250,252,0.96);
}

@media (max-width: 1280px) {
  .console-body,
  .output-shell,
  .console-terminal :deep(.terminal-wrapper),
  .console-terminal :deep(.terminal-container) {
    min-height: 420px;
    height: 420px;
  }
}

@media (max-width: 960px) {
  .toolbar-shell {
    padding: 10px;
  }

  .console-body,
  .output-shell,
  .console-terminal :deep(.terminal-wrapper),
  .console-terminal :deep(.terminal-container) {
    min-height: 320px;
    height: 320px;
  }

  .toolbar-actions {
    justify-content: flex-start !important;
  }

  .toolbar-actions :deep(.v-btn) {
    flex: 1 1 calc(50% - 8px);
  }
}

@media (max-width: 640px) {
  .toolbar-actions :deep(.v-btn) {
    flex: 1 1 100%;
  }

  .hero-copy .text-h4 {
    font-size: 1.7rem !important;
  }
}
</style>