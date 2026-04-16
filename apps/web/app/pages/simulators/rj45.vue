<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import Rj45DemoScene from '~/components/simulators/Rj45DemoScene.client.vue'

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
    description: 'Arrange the wires in T568B order: white-orange, orange, white-green, blue, white-blue, green, white-brown, brown.',
  },
  {
    title: 'Trim the Wires',
    description: 'Flatten the arranged wires and trim them to about 1/2 inch from the jacket edge.',
  },
  {
    title: 'Insert into Connector',
    description: 'Insert the wires into the RJ45 plug with the gold pins facing up and the clip on the bottom.',
  },
  {
    title: 'Crimp the Connector',
    description: 'Insert the connector into the crimping tool and squeeze securely to lock the pins onto the wires.',
  },
]

const currentStepData = computed<StepItem>(() => {
  return steps[currentStep.value] ?? steps[0]!
})

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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
  <v-container fluid class="py-6">
    <v-row>
      <v-col cols="12" lg="8">
        <Rj45DemoScene ref="sceneRef" />
      </v-col>

      <v-col cols="12" lg="4">
        <v-card rounded="xl" elevation="8">
          <v-card-title class="text-h5 font-weight-bold">
            RJ45 Guided Demo
          </v-card-title>

          <v-card-subtitle>
            Interactive animated reference
          </v-card-subtitle>

          <v-card-text class="pt-4">
            <v-alert
              type="info"
              variant="tonal"
              class="mb-4"
            >
              This is a guided animated demo with motion, not a full physics-based simulator.
            </v-alert>

            <div class="mb-4">
              <div class="text-overline">Current Step</div>
              <div class="text-h6 font-weight-bold">
                {{ currentStep + 1 }} / {{ steps.length }} — {{ currentStepData.title }}
              </div>
              <div class="text-medium-emphasis">
                {{ currentStepData.description }}
              </div>
            </div>

            <v-divider class="mb-4" />

            <div class="text-subtitle-1 font-weight-bold mb-2">
              Sequence
            </div>

            <v-list density="compact" class="mb-4">
              <v-list-item
                v-for="(step, index) in steps"
                :key="step.title"
                :class="index === currentStep ? 'active-step' : ''"
              >
                <template #prepend>
                  <v-avatar
                    size="28"
                    :color="index === currentStep ? 'primary' : 'grey-lighten-1'"
                  >
                    <span class="text-caption">{{ index + 1 }}</span>
                  </v-avatar>
                </template>

                <v-list-item-title>{{ step.title }}</v-list-item-title>
                <v-list-item-subtitle>{{ step.description }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>

            <v-row dense>
              <v-col cols="12">
                <v-btn
                  block
                  color="primary"
                  :loading="isPlaying"
                  @click="playAll"
                >
                  Play Full Demo
                </v-btn>
              </v-col>

              <v-col cols="6">
                <v-btn
                  block
                  variant="outlined"
                  @click="nextStep"
                >
                  Next Step
                </v-btn>
              </v-col>

              <v-col cols="6">
                <v-btn
                  block
                  variant="outlined"
                  color="secondary"
                  @click="resetDemo"
                >
                  Reset
                </v-btn>
              </v-col>

              <v-col cols="12">
                <v-btn
                  block
                  variant="text"
                  color="error"
                  @click="stopDemo"
                >
                  Stop
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.active-step {
  background: rgba(var(--v-theme-primary), 0.08);
  border-radius: 12px;
}
</style>