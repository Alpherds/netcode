<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { definePageMeta, navigateTo } from '#imports'
import Rj45DemoScene from '~/components/simulators/Rj45DemoScene.client.vue'

definePageMeta({
  middleware: 'auth',
})

type SceneExpose = {
  resetScene: () => Promise<void>
  playStep: (step: number) => Promise<void>
  stopScene: () => void
}

type StepItem = {
  title: string
  description: string
}

const sceneRef = ref<SceneExpose | null>(null)
const isPlaying = ref(false)
const currentStep = ref(0)

const steps: StepItem[] = [
  {
    title: 'Strip the Cable Jacket',
    description: 'Remove about 1 inch of the outer jacket and expose the inner wires.',
  },
  {
    title: 'Untwist and Organize',
    description:
      'Arrange the wires in T568B order: white-orange, orange, white-green, blue, white-blue, green, white-brown, brown.',
  },
  {
    title: 'Trim the Wires',
    description:
      'Flatten the arranged wires and trim them to about 1/2 inch from the jacket edge.',
  },
  {
    title: 'Insert into Connector',
    description:
      'Insert the wires into the RJ45 plug with the gold pins facing up and the clip on the bottom.',
  },
  {
    title: 'Crimp the Connector',
    description:
      'Insert the connector into the crimping tool and squeeze securely to lock the pins onto the wires.',
  },
]

const currentStepData = computed<StepItem>(() => {
  return steps[currentStep.value] ?? steps[0]!
})

const stepProgress = computed(() => {
  return Math.round(((currentStep.value + 1) / steps.length) * 100)
})

const moduleStatusText = computed(() => {
  return isPlaying.value ? 'Running Demo' : 'Ready'
})

const moduleStatusColor = computed(() => {
  return isPlaying.value ? 'success' : 'primary'
})

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function goBack() {
  await navigateTo('/')
}

async function resetDemo() {
  isPlaying.value = false
  currentStep.value = 0
  await sceneRef.value?.resetScene()
}

async function nextStep() {
  if (!sceneRef.value) return
  if (currentStep.value >= steps.length - 1) return

  currentStep.value += 1
  await sceneRef.value.playStep(currentStep.value + 1)
}

async function playAll() {
  if (!sceneRef.value) return

  isPlaying.value = true
  await resetDemo()
  isPlaying.value = true

  for (let index = 0; index < steps.length; index++) {
    if (!isPlaying.value) break
    currentStep.value = index
    await sceneRef.value.playStep(index + 1)
    await delay(500)
  }

  isPlaying.value = false
}

function stopDemo() {
  isPlaying.value = false
  sceneRef.value?.stopScene()
}

onMounted(async () => {
  await nextTick()
  await sceneRef.value?.resetScene()
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
              RJ45 Guided Demo
            </div>

            <div class="d-flex flex-wrap ga-2 mb-4">
              <v-chip color="primary" variant="outlined" rounded="pill">
                5-Step Procedure
              </v-chip>

              <v-chip color="grey-darken-1" variant="outlined" rounded="pill">
                T568B
              </v-chip>

              <v-chip color="indigo" variant="outlined" rounded="pill">
                Interactive Demo
              </v-chip>
            </div>

            <p class="text-body-1 text-medium-emphasis mb-0">
              Practice the RJ45 crimping procedure through a guided animated simulator.
              The flow follows the real sequence: strip the jacket, organize the wires,
              trim them evenly, insert into the connector, and crimp.
            </p>
          </div>

          <div class="hero-action-stack d-flex flex-wrap ga-3 justify-end">
            <v-btn
              color="primary"
              rounded="pill"
              size="large"
              prepend-icon="mdi-play-circle-outline"
              :loading="isPlaying"
              @click="playAll"
            >
              Play Full Demo
            </v-btn>

            <v-btn
              color="teal-darken-1"
              rounded="pill"
              size="large"
              prepend-icon="mdi-refresh"
              @click="resetDemo"
            >
              Reset Demo
            </v-btn>

            <v-btn
              color="error"
              rounded="pill"
              size="large"
              prepend-icon="mdi-stop-circle-outline"
              @click="stopDemo"
            >
              Stop
            </v-btn>
          </div>
        </div>

        <v-alert
          type="info"
          variant="tonal"
          class="mt-5"
        >
          This module is a guided animated demonstration designed for learning flow and visual reference.
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
                  Visual demo area for the RJ45 procedure.
                </div>
              </div>

              <v-chip color="primary" variant="tonal" rounded="pill">
                Step {{ currentStep + 1 }} of {{ steps.length }}
              </v-chip>
            </div>

            <div class="simulator-canvas-shell">
              <Rj45DemoScene ref="sceneRef" />
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
                  prepend-icon="mdi-skip-next"
                  @click="nextStep"
                >
                  Next Step
                </v-btn>

                <v-btn
                  color="grey-darken-2"
                  variant="outlined"
                  rounded="pill"
                  prepend-icon="mdi-refresh"
                  @click="resetDemo"
                >
                  Restart
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
                {{ currentStep + 1 }}. {{ currentStepData.title }}
              </div>
              <div class="text-body-2 text-medium-emphasis">
                {{ currentStepData.description }}
              </div>
            </v-sheet>

            <div class="d-flex flex-column ga-3">
              <v-card
                v-for="(step, index) in steps"
                :key="step.title"
                rounded="xl"
                :elevation="index === currentStep ? 3 : 0"
                :class="['step-card', { 'step-card-active': index === currentStep }]"
              >
                <v-card-text class="pa-4 d-flex ga-3 align-start">
                  <v-avatar
                    :color="index === currentStep ? 'primary' : 'grey-lighten-1'"
                    size="38"
                  >
                    <span class="text-body-2 font-weight-bold">
                      {{ index + 1 }}
                    </span>
                  </v-avatar>

                  <div class="flex-grow-1">
                    <div class="font-weight-bold mb-1">
                      {{ step.title }}
                    </div>
                    <div class="text-body-2 text-medium-emphasis">
                      {{ step.description }}
                    </div>
                  </div>
                </v-card-text>
              </v-card>
            </div>
          </v-card-text>
        </v-card>

        <v-card rounded="xl" elevation="3" class="section-card">
          <v-card-text class="pa-5">
            <div class="text-h6 font-weight-bold mb-3">Module Notes</div>

            <v-alert type="success" variant="tonal" class="mb-3">
              Standard wire order used in this module is <strong>T568B</strong>.
            </v-alert>

            <div class="d-flex flex-wrap ga-3">
              <v-sheet rounded="xl" color="success" variant="tonal" class="summary-box pa-4">
                <div class="text-overline">Procedure</div>
                <div class="text-h6 font-weight-bold">5 Steps</div>
              </v-sheet>

              <v-sheet rounded="xl" color="info" variant="tonal" class="summary-box pa-4">
                <div class="text-overline">Connector</div>
                <div class="text-h6 font-weight-bold">RJ45</div>
              </v-sheet>

              <v-sheet rounded="xl" color="indigo" variant="tonal" class="summary-box pa-4">
                <div class="text-overline">Mode</div>
                <div class="text-h6 font-weight-bold">Guided</div>
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
  border-radius: 20px;
  overflow: hidden;
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

@media (max-width: 960px) {
  .hero-action-stack {
    min-width: unset;
    width: 100%;
    justify-content: stretch;
  }

  .hero-action-stack :deep(.v-btn) {
    flex: 1 1 100%;
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