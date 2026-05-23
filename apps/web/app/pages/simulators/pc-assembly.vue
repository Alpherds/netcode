<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { definePageMeta, navigateTo } from '#imports'

definePageMeta({
  middleware: 'auth',
})

type StepItem = {
  title: string
  description: string
  partId: string
}

const unityFrame = ref<HTMLIFrameElement | null>(null)

const currentMode = ref<'Assembly' | 'Disassembly'>('Assembly')
const currentStep = ref(0)
const currentStepText = ref('Step 1: Install the motherboard.')
const warningText = ref('')
const currentPartId = ref('motherboard')

const assemblySteps: StepItem[] = [
  {
    title: 'Install the Motherboard',
    description: 'Place the motherboard into the PC case and align it with the correct slot.',
    partId: 'motherboard',
  },
  {
    title: 'Install the CPU',
    description: 'Place the CPU into the processor socket on the motherboard.',
    partId: 'cpu',
  },
  {
    title: 'Install the CPU Cooler',
    description: 'Attach the CPU cooler above the processor to help control temperature.',
    partId: 'cooler',
  },
  {
    title: 'Install the RAM',
    description: 'Insert the RAM module into the memory slot on the motherboard.',
    partId: 'ram',
  },
  {
    title: 'Install the PSU',
    description: 'Place the power supply unit into its slot inside the PC case.',
    partId: 'psu',
  },
  {
    title: 'Connect the 24-pin Cable',
    description: 'Connect the main motherboard power cable from the PSU to the motherboard.',
    partId: 'cable_24pin',
  },
  {
    title: 'Install the Storage Drive',
    description: 'Place the storage drive into the drive bay.',
    partId: 'storage',
  },
  {
    title: 'Install the GPU',
    description: 'Insert the graphics card into the PCIe slot.',
    partId: 'gpu',
  },
]

const disassemblySteps: StepItem[] = [
  {
    title: 'Remove the GPU',
    description: 'Drag the graphics card away from the PCIe slot to remove it.',
    partId: 'gpu',
  },
  {
    title: 'Remove the Storage Drive',
    description: 'Drag the storage drive away from the drive bay.',
    partId: 'storage',
  },
  {
    title: 'Disconnect the 24-pin Cable',
    description: 'Drag the motherboard power cable away to disconnect it.',
    partId: 'cable_24pin',
  },
  {
    title: 'Remove the PSU',
    description: 'Drag the power supply unit away from the case.',
    partId: 'psu',
  },
  {
    title: 'Remove the RAM',
    description: 'Drag the RAM module away from the memory slot.',
    partId: 'ram',
  },
  {
    title: 'Remove the CPU Cooler',
    description: 'Drag the CPU cooler away from the processor area.',
    partId: 'cooler',
  },
  {
    title: 'Remove the CPU',
    description: 'Drag the CPU away from the processor socket.',
    partId: 'cpu',
  },
  {
    title: 'Remove the Motherboard',
    description: 'Drag the motherboard away from the PC case.',
    partId: 'motherboard',
  },
]

const partDetails: Record<string, { name: string; meaning: string }> = {
  motherboard: {
    name: 'Motherboard',
    meaning: 'The main circuit board where the CPU, RAM, GPU, storage, and power connectors are installed.',
  },
  cpu: {
    name: 'CPU',
    meaning: 'The central processing unit executes instructions and acts as the main brain of the computer.',
  },
  cooler: {
    name: 'CPU Cooler',
    meaning: 'The CPU cooler removes heat from the processor to prevent overheating.',
  },
  ram: {
    name: 'RAM',
    meaning: 'Random Access Memory temporarily stores data used by active programs.',
  },
  psu: {
    name: 'Power Supply Unit',
    meaning: 'The PSU converts electricity and supplies power to all computer components.',
  },
  cable_24pin: {
    name: '24-pin Motherboard Power Cable',
    meaning: 'This cable delivers main power from the PSU to the motherboard.',
  },
  storage: {
    name: 'Storage Drive',
    meaning: 'The storage drive keeps files, applications, and the operating system.',
  },
  gpu: {
    name: 'Graphics Card',
    meaning: 'The GPU handles graphics processing and display output.',
  },
}

const currentSteps = computed(() => {
  return currentMode.value === 'Assembly' ? assemblySteps : disassemblySteps
})

const isComplete = computed(() => {
  return currentStep.value >= currentSteps.value.length
})

const isAssemblyButtonDisabled = computed(() => {
  if (!isComplete.value) return true

  return currentMode.value === 'Assembly'
})

const isDisassemblyButtonDisabled = computed(() => {
  if (!isComplete.value) return true

  return currentMode.value === 'Disassembly'
})

const currentStepData = computed<StepItem>(() => {
  if (isComplete.value) {
    return {
      title: `${currentMode.value} Complete`,
      description: 'All required steps have been completed successfully.',
      partId: '',
    }
  }

  return currentSteps.value[currentStep.value] ?? currentSteps.value[0]!
})

const stepProgress = computed(() => {
  if (isComplete.value) return 100
  return Math.round(((currentStep.value + 1) / currentSteps.value.length) * 100)
})

const moduleStatusText = computed(() => {
  return isComplete.value ? 'Complete' : currentMode.value
})

const moduleStatusColor = computed(() => {
  if (isComplete.value) return 'success'
  return currentMode.value === 'Assembly' ? 'primary' : 'deep-purple'
})

const currentPart = computed(() => {
  return partDetails[currentPartId.value] || {
    name: 'Completed',
    meaning: 'All required steps are complete.',
  }
})

async function goBack() {
  await navigateTo('/')
}

function sendToUnity(methodName: string) {
  const frameWindow = unityFrame.value?.contentWindow
  if (!frameWindow) return

  frameWindow.postMessage(
    {
      type: 'UNITY_SEND_MESSAGE',
      objectName: 'GameManager',
      methodName,
    },
    '*'
  )
}

function setAssemblyMode() {
  if (isAssemblyButtonDisabled.value) return

  currentMode.value = 'Assembly'
  currentStep.value = 0
  currentPartId.value = 'motherboard'
  currentStepText.value = 'Step 1: Install the motherboard.'
  warningText.value = ''
  sendToUnity('SetAssemblyModeFromWeb')
}

function setDisassemblyMode() {
  if (isDisassemblyButtonDisabled.value) return

  currentMode.value = 'Disassembly'
  currentStep.value = 0
  currentPartId.value = 'gpu'
  currentStepText.value = 'Step 1: Remove the GPU.'
  warningText.value = ''
  sendToUnity('SetDisassemblyModeFromWeb')
}
function handleUnityMessage(event: MessageEvent) {
  const data = event.data

  if (!data || data.source !== 'unity-pc-simulator') return

  if (data.type === 'UNITY_MODE_UPDATE') {
    currentMode.value = data.message === 'Disassembly' ? 'Disassembly' : 'Assembly'
  }

  if (data.type === 'UNITY_STEP_UPDATE') {
    currentStepText.value = data.message
    currentStep.value = Number(data.step ?? 0)
    currentPartId.value = data.partId || ''
  }

  if (data.type === 'UNITY_WARNING') {
    warningText.value = data.message
  }

  if (data.type === 'UNITY_CLEAR_WARNING') {
    warningText.value = ''
  }
}

onMounted(() => {
  window.addEventListener('message', handleUnityMessage)
})

onBeforeUnmount(() => {
  window.removeEventListener('message', handleUnityMessage)
})
</script>

<template>
  <v-container fluid class="simulator-page pa-4 pa-md-6">
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
            :color="moduleStatusColor"
            variant="tonal"
            rounded="pill"
            size="large"
          >
            {{ moduleStatusText }}
          </v-chip>
        </div>

        <div class="d-flex flex-column flex-lg-row justify-space-between align-start ga-6">
          <div class="hero-copy">
            <div class="text-overline text-primary font-weight-bold mb-2">
              Learning Tools / Simulator
            </div>

            <div class="text-h4 font-weight-bold mb-2">
              PC Assembly Simulator
            </div>

            <div class="d-flex flex-wrap ga-2 mb-4">
              <v-chip color="primary" variant="outlined" rounded="pill">
                3D Interactive
              </v-chip>

              <v-chip color="grey-darken-1" variant="outlined" rounded="pill">
                Assembly
              </v-chip>

              <v-chip color="deep-purple" variant="outlined" rounded="pill">
                Disassembly
              </v-chip>
            </div>

            <p class="text-body-1 text-medium-emphasis mb-0">
              Practice installing and removing PC components through a guided 3D
              simulator. Follow the correct order for the motherboard, CPU, cooler,
              RAM, PSU, power cable, storage drive, and GPU.
            </p>
          </div>

          <div class="hero-action-stack d-flex flex-wrap ga-3 justify-end">
<v-btn
  color="primary"
  rounded="pill"
  size="large"
  prepend-icon="mdi-desktop-tower-monitor"
  :disabled="isAssemblyButtonDisabled"
  @click="setAssemblyMode"
>
  Assembly Mode
</v-btn>

<v-btn
  color="deep-purple-darken-1"
  rounded="pill"
  size="large"
  prepend-icon="mdi-tools"
  :disabled="isDisassemblyButtonDisabled"
  @click="setDisassemblyMode"
>
  Disassembly Mode
</v-btn>
          </div>
        </div>

        <v-alert
          v-if="warningText"
          type="warning"
          variant="tonal"
          class="mt-5"
        >
          {{ warningText }}
        </v-alert>

        <v-alert
          v-else
          type="info"
          variant="tonal"
          class="mt-5"
        >
          Drag each PC component into the correct location. The guide will update
          automatically as you complete each step.
        </v-alert>
      </v-card-text>
    </v-card>

    <v-row dense>
      <v-col cols="12" lg="8">
        <v-card rounded="xl" elevation="3" class="section-card mb-6 mb-lg-0">
          <v-card-text class="pa-5">
            <div class="d-flex flex-column flex-md-row justify-space-between align-start ga-3 mb-4">
              <div>
                <div class="text-h5 font-weight-bold">Simulator Workspace</div>
                <div class="text-body-2 text-medium-emphasis">
                  Interactive 3D workspace powered by Unity WebGL.
                </div>
              </div>

              <v-chip color="primary" variant="tonal" rounded="pill">
                {{
                  isComplete
                    ? 'Complete'
                    : `Step ${currentStep + 1} of ${currentSteps.length}`
                }}
              </v-chip>
            </div>

            <div class="simulator-canvas-shell">
              <iframe
                ref="unityFrame"
                src="/pc-assembly/index.html"
                class="unity-frame"
                allowfullscreen
              />
            </div>

            <div class="d-flex flex-column flex-md-row justify-space-between align-start align-md-center ga-4 mt-4">
              <div class="flex-grow-1 w-100">
                <div class="text-caption text-medium-emphasis mb-2">
                  Procedure Progress
                </div>
                <v-progress-linear
                  :model-value="stepProgress"
                  color="primary"
                  rounded
                  height="10"
                />
              </div>

              <div class="d-flex flex-wrap ga-2 action-cluster">
<v-btn
  color="primary"
  variant="tonal"
  rounded="pill"
  prepend-icon="mdi-desktop-tower-monitor"
  :disabled="isAssemblyButtonDisabled"
  @click="setAssemblyMode"
>
  Assembly
</v-btn>

<v-btn
  color="deep-purple-darken-1"
  variant="outlined"
  rounded="pill"
  prepend-icon="mdi-tools"
  :disabled="isDisassemblyButtonDisabled"
  @click="setDisassemblyMode"
>
  Disassembly
</v-btn>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" lg="4">
        <v-card rounded="xl" elevation="3" class="section-card mb-6">
          <v-card-text class="pa-5">
            <div class="d-flex justify-space-between align-start ga-3 mb-4">
              <div>
                <div class="text-h5 font-weight-bold">Procedure Guide</div>
                <div class="text-body-2 text-medium-emphasis">
                  Follow the current simulator step.
                </div>
              </div>

              <v-chip
                :color="moduleStatusColor"
                variant="tonal"
                rounded="pill"
              >
                {{ moduleStatusText }}
              </v-chip>
            </div>

            <v-sheet rounded="xl" color="surface-variant" class="pa-4 mb-4 current-step-box">
              <div class="text-overline text-primary font-weight-bold mb-1">
                Current Step
              </div>
              <div class="text-h6 font-weight-bold mb-2">
                {{
                  isComplete
                    ? currentStepData.title
                    : `${currentStep + 1}. ${currentStepData.title}`
                }}
              </div>
              <div class="text-body-2 text-medium-emphasis">
                {{ currentStepData.description }}
              </div>
            </v-sheet>

            <v-sheet rounded="xl" color="surface-variant" class="pa-4 mb-4 current-step-box">
              <div class="text-overline text-primary font-weight-bold mb-1">
                Current Part
              </div>
              <div class="text-h6 font-weight-bold mb-2">
                {{ currentPart.name }}
              </div>
              <div class="text-body-2 text-medium-emphasis">
                {{ currentPart.meaning }}
              </div>
            </v-sheet>

<div class="steps-compact-list d-flex flex-column ga-2">
  <v-card
    v-for="(step, index) in currentSteps"
    :key="`${currentMode}-${step.title}`"
    rounded="xl"
    :elevation="index === currentStep && !isComplete ? 3 : 0"
    :class="[
      'step-card',
      { 'step-card-active': index === currentStep && !isComplete }
    ]"
  >
    <v-card-text class="pa-3 d-flex ga-3 align-center">
      <v-avatar
        :color="index === currentStep && !isComplete ? 'primary' : 'grey-lighten-1'"
        size="32"
      >
        <span class="text-body-2 font-weight-bold">
          {{ index + 1 }}
        </span>
      </v-avatar>

      <div class="flex-grow-1">
        <div class="font-weight-bold text-body-2">
          {{ step.title }}
        </div>

        <div
          v-if="index === currentStep && !isComplete"
          class="text-caption text-medium-emphasis mt-1"
        >
          {{ step.description }}
        </div>
      </div>

      <v-icon
        v-if="index < currentStep || isComplete"
        color="success"
        size="20"
      >
        mdi-check-circle
      </v-icon>
    </v-card-text>
  </v-card>
</div>
          </v-card-text>
        </v-card>

        <v-card rounded="xl" elevation="3" class="section-card">
          <v-card-text class="pa-5">
            <div class="text-h6 font-weight-bold mb-3">Module Notes</div>

            <v-alert type="success" variant="tonal" class="mb-3">
              This simulator checks the correct order and slot placement of PC components.
            </v-alert>

            <div class="d-flex flex-wrap ga-3">
              <v-sheet rounded="xl" color="success" variant="tonal" class="summary-box pa-4">
                <div class="text-overline">Procedure</div>
                <div class="text-h6 font-weight-bold">8 Steps</div>
              </v-sheet>

              <v-sheet rounded="xl" color="info" variant="tonal" class="summary-box pa-4">
                <div class="text-overline">Mode</div>
                <div class="text-h6 font-weight-bold">{{ currentMode }}</div>
              </v-sheet>

              <v-sheet rounded="xl" color="deep-purple" variant="tonal" class="summary-box pa-4">
                <div class="text-overline">Engine</div>
                <div class="text-h6 font-weight-bold">Unity</div>
              </v-sheet>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.simulator-page {
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

.simulator-canvas-shell {
  height: 620px;
  border-radius: 20px;
  overflow: hidden;
  background: #111827;
  border: 1px solid rgba(15, 23, 42, 0.08);
}

.unity-frame {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
  background: #111827;
}

.current-step-box {
  border: 1px solid rgba(37, 99, 235, 0.08);
}

.step-card {
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: linear-gradient(180deg, #ffffff 0%, #fbfcff 100%);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease;
}

.step-card-active {
  border-color: rgba(37, 99, 235, 0.18);
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08);
}

.summary-box {
  min-width: 140px;
}

.action-cluster {
  flex-shrink: 0;
}

.steps-compact-list {
  max-height: 520px;
  overflow-y: auto;
  padding-right: 4px;
}

.steps-compact-list::-webkit-scrollbar {
  width: 6px;
}

.steps-compact-list::-webkit-scrollbar-thumb {
  background: rgba(100, 116, 139, 0.35);
  border-radius: 999px;
}

.step-card :deep(.v-card-text) {
  min-height: 64px;
}

.step-card-active {
  border-color: rgba(37, 99, 235, 0.22);
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.08);
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

  .simulator-canvas-shell {
    height: 520px;
  }

  .action-cluster {
    width: 100%;
  }

  .action-cluster :deep(.v-btn) {
    flex: 1 1 100%;
  }

  .summary-box {
    min-width: calc(50% - 12px);
  }

  
}
</style>