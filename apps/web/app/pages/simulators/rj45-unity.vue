<script setup lang="ts">
import { computed, ref } from 'vue'
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
const iframeKey = ref(0)

const currentStep = ref(0)
const warningText = ref('')

const rj45Steps: StepItem[] = [
  {
    title: 'Strip the Cable',
    description: 'Drag the crimping tool to the cut indicator to remove the cable jacket and reveal the wires.',
    partId: 'cable',
  },
  {
    title: 'Arrange the Wires',
    description: 'Arrange the eight wires in the correct T568B order.',
    partId: 'wires',
  },
  {
    title: 'Trim the Wires',
    description: 'Use the crimping tool to cut the arranged wires evenly before inserting them into the RJ45 plug.',
    partId: 'trim',
  },
  {
    title: 'Insert the RJ45 Plug',
    description: 'Drag the RJ45 plug toward the aligned wires and insert them properly into the connector.',
    partId: 'plug',
  },
  {
    title: 'Crimp the Connector',
    description: 'Use the crimping tool to crimp the RJ45 plug and lock the wires in place.',
    partId: 'crimp',
  },
  {
    title: 'Finished Cable',
    description: 'The RJ45 LAN cable is now assembled and ready for checking.',
    partId: 'finished',
  },
]

const partDetails: Record<string, { name: string; meaning: string }> = {
  cable: {
    name: 'LAN Cable',
    meaning: 'The cable jacket protects the internal twisted wires used for network communication.',
  },
  wires: {
    name: 'T568B Wire Order',
    meaning: 'The correct order is White/Orange, Orange, White/Green, Blue, White/Blue, Green, White/Brown, and Brown.',
  },
  trim: {
    name: 'Wire Trimming',
    meaning: 'The wires must be straight and evenly cut so they can fit properly inside the RJ45 plug.',
  },
  plug: {
    name: 'RJ45 Plug',
    meaning: 'The RJ45 connector holds the arranged wires and connects the cable to network ports.',
  },
  crimp: {
    name: 'Crimping Tool',
    meaning: 'The crimping tool presses the RJ45 connector pins into the wires to secure the connection.',
  },
  finished: {
    name: 'Completed RJ45 Cable',
    meaning: 'The assembled cable can now be tested for proper wiring and connectivity.',
  },
}

const isComplete = computed(() => {
  return currentStep.value >= rj45Steps.length - 1
})

const currentStepData = computed<StepItem>(() => {
  return rj45Steps[currentStep.value] ?? rj45Steps[0]!
})

const stepProgress = computed(() => {
  return Math.round(((currentStep.value + 1) / rj45Steps.length) * 100)
})

const moduleStatusText = computed(() => {
  return isComplete.value ? 'Complete' : 'Assembly'
})

const moduleStatusColor = computed(() => {
  return isComplete.value ? 'success' : 'primary'
})

const currentPart = computed(() => {
  return partDetails[currentStepData.value.partId] || {
    name: 'RJ45 Simulator',
    meaning: 'Follow the simulator procedure to complete the RJ45 cable assembly.',
  }
})

async function goBack() {
  await navigateTo('/')
}

function reloadSimulator() {
  iframeKey.value++
  currentStep.value = 0
  warningText.value = ''
}

function openFullscreen() {
  const frame = unityFrame.value

  if (!frame) return

  if (frame.requestFullscreen) {
    frame.requestFullscreen()
  }
}

function nextGuideStep() {
  if (currentStep.value < rj45Steps.length - 1) {
    currentStep.value++
  }
}

function previousGuideStep() {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}
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
              RJ45 Cable Assembly Simulator
            </div>

            <div class="d-flex flex-wrap ga-2 mb-4">
              <v-chip color="primary" variant="outlined" rounded="pill">
                3D Interactive
              </v-chip>

              <v-chip color="grey-darken-1" variant="outlined" rounded="pill">
                LAN Cable
              </v-chip>

              <v-chip color="deep-purple" variant="outlined" rounded="pill">
                T568B Wiring
              </v-chip>
            </div>

            <p class="text-body-1 text-medium-emphasis mb-0">
              Practice the proper RJ45 cable assembly process through a guided
              Unity WebGL simulator. Follow each step from stripping the cable,
              arranging the wires, trimming, inserting the plug, and crimping the connector.
            </p>
          </div>

          <div class="hero-action-stack d-flex flex-wrap ga-3 justify-end">
            <v-btn
              color="primary"
              rounded="pill"
              size="large"
              prepend-icon="mdi-refresh"
              @click="reloadSimulator"
            >
              Reload Simulator
            </v-btn>

            <v-btn
              color="deep-purple-darken-1"
              rounded="pill"
              size="large"
              prepend-icon="mdi-fullscreen"
              @click="openFullscreen"
            >
              Fullscreen
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
          Drag the correct object in the Unity workspace. Use the procedure guide
          on the right as your step-by-step reference.
        </v-alert>
      </v-card-text>
    </v-card>

    <v-row dense>
      <v-col cols="12" lg="8">
        <v-card rounded="xl" elevation="3" class="section-card mb-6 mb-lg-0">
          <v-card-text class="pa-5">
            <div class="d-flex flex-column flex-md-row justify-space-between align-start ga-3 mb-4">
              <div>
                <div class="text-h5 font-weight-bold">
                  Simulator Workspace
                </div>

                <div class="text-body-2 text-medium-emphasis">
                  Interactive RJ45 cable assembly workspace powered by Unity WebGL.
                </div>
              </div>

              <v-chip color="primary" variant="tonal" rounded="pill">
                Step {{ currentStep + 1 }} of {{ rj45Steps.length }}
              </v-chip>
            </div>

            <div class="simulator-canvas-shell">
              <iframe
                ref="unityFrame"
                :key="iframeKey"
                src="/rj45-unity/index.html"
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
                  color="grey-darken-1"
                  variant="outlined"
                  rounded="pill"
                  prepend-icon="mdi-chevron-left"
                  :disabled="currentStep === 0"
                  @click="previousGuideStep"
                >
                  Previous
                </v-btn>

                <v-btn
                  color="primary"
                  variant="tonal"
                  rounded="pill"
                  prepend-icon="mdi-chevron-right"
                  :disabled="currentStep >= rj45Steps.length - 1"
                  @click="nextGuideStep"
                >
                  Next Guide
                </v-btn>

                <v-btn
                  color="deep-purple-darken-1"
                  variant="outlined"
                  rounded="pill"
                  prepend-icon="mdi-fullscreen"
                  @click="openFullscreen"
                >
                  Fullscreen
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
                <div class="text-h5 font-weight-bold">
                  Procedure Guide
                </div>

                <div class="text-body-2 text-medium-emphasis">
                  Follow the RJ45 assembly procedure.
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

            <v-sheet
              rounded="xl"
              color="surface-variant"
              class="pa-4 mb-4 current-step-box"
            >
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
                v-for="(step, index) in rj45Steps"
                :key="step.title"
                rounded="xl"
                :elevation="index === currentStep ? 3 : 0"
                :class="[
                  'step-card',
                  { 'step-card-active': index === currentStep }
                ]"
              >
                <v-card-text class="pa-3 d-flex ga-3 align-center">
                  <v-avatar
                    :color="index === currentStep ? 'primary' : 'grey-lighten-1'"
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
                      v-if="index === currentStep"
                      class="text-caption text-medium-emphasis mt-1"
                    >
                      {{ step.description }}
                    </div>
                  </div>

                  <v-icon
                    v-if="index < currentStep"
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
            <div class="text-h6 font-weight-bold mb-3">
              Module Notes
            </div>

            <v-alert type="success" variant="tonal" class="mb-3">
              This simulator helps students practice the correct RJ45 cable assembly sequence.
            </v-alert>

            <div class="d-flex flex-wrap ga-3">
              <v-sheet
                rounded="xl"
                color="success"
                class="summary-box pa-4"
              >
                <div class="text-overline">
                  Procedure
                </div>

                <div class="text-h6 font-weight-bold">
                  6 Steps
                </div>
              </v-sheet>

              <v-sheet
                rounded="xl"
                color="info"
                class="summary-box pa-4"
              >
                <div class="text-overline">
                  Standard
                </div>

                <div class="text-h6 font-weight-bold">
                  T568B
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
  max-width: 780px;
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
  border-color: rgba(37, 99, 235, 0.22);
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.08);
}

.step-card :deep(.v-card-text) {
  min-height: 64px;
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

.summary-box {
  min-width: 140px;
  color: white;
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