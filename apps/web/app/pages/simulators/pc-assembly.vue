<template>
  <v-container fluid class="pa-0 pc-page">
    <v-row no-gutters class="fill-height">
      <v-col cols="9" class="unity-area">
        <iframe
          ref="unityFrame"
          src="/pc-assembly/index.html"
          class="unity-frame"
          allowfullscreen
        />
      </v-col>

      <v-col cols="3" class="side-panel pa-4">
        <v-card class="pa-4 mb-4" rounded="xl">
          <h2 class="text-h6 mb-2">PC Assembly Simulator</h2>
          <p class="text-body-2">
            Assemble and disassemble PC components by dragging them into the correct slot.
          </p>
        </v-card>

<v-card class="pa-4 mb-4" rounded="xl">
  <div class="text-caption">Current Mode</div>
  <div class="text-h6">{{ currentMode }}</div>
</v-card>

<v-card class="pa-4 mb-4" rounded="xl">
  <div class="text-caption mb-1">Current Step</div>
  <div class="text-h6">{{ currentStepText }}</div>
</v-card>

<v-alert
  v-if="warningText"
  type="warning"
  variant="tonal"
  class="mb-4"
>
  {{ warningText }}
</v-alert>

<v-card class="pa-4 mb-4" rounded="xl">
  <div class="text-caption mb-1">Current Part</div>
  <div class="text-h6 mb-2">{{ currentPart.name }}</div>
  <p class="text-body-2 mb-0">
    {{ currentPart.meaning }}
  </p>
</v-card>

        <v-alert type="info" variant="tonal" class="mb-4">
          The simulator is running inside Unity WebGL.
        </v-alert>

        <v-btn
          block
          color="primary"
          size="large"
          class="mb-3"
          @click="setAssemblyMode"
        >
          Assembly Mode
        </v-btn>

        <v-btn
          block
          color="secondary"
          size="large"
          @click="setDisassemblyMode"
        >
          Disassembly Mode
        </v-btn>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
const unityFrame = ref(null)

const currentMode = ref('Assembly')
const currentStepText = ref('Step 1: Install the motherboard.')
const warningText = ref('')
const currentPartId = ref('motherboard')

const partDetails = {
  motherboard: {
    name: 'Motherboard',
    meaning: 'The main circuit board where the CPU, RAM, GPU, storage, and power connectors are installed.'
  },
  cpu: {
    name: 'CPU',
    meaning: 'The central processing unit executes instructions and acts as the main brain of the computer.'
  },
  cooler: {
    name: 'CPU Cooler',
    meaning: 'The CPU cooler removes heat from the processor to prevent overheating.'
  },
  ram: {
    name: 'RAM',
    meaning: 'Random Access Memory temporarily stores data used by active programs.'
  },
  psu: {
    name: 'Power Supply Unit',
    meaning: 'The PSU converts electricity and supplies power to all computer components.'
  },
  cable_24pin: {
    name: '24-pin Motherboard Power Cable',
    meaning: 'This cable delivers main power from the PSU to the motherboard.'
  },
  storage: {
    name: 'Storage Drive',
    meaning: 'The storage drive keeps files, applications, and the operating system.'
  },
  gpu: {
    name: 'Graphics Card',
    meaning: 'The GPU handles graphics processing and display output.'
  }
}

const currentPart = computed(() => {
  return partDetails[currentPartId.value] || {
    name: 'Completed',
    meaning: 'All required steps are complete.'
  }
})

function sendToUnity(methodName) {
  const frameWindow = unityFrame.value?.contentWindow
  if (!frameWindow) return

  frameWindow.postMessage(
    {
      type: 'UNITY_SEND_MESSAGE',
      objectName: 'GameManager',
      methodName
    },
    '*'
  )
}

function setAssemblyMode() {
  currentMode.value = 'Assembly'
  sendToUnity('SetAssemblyModeFromWeb')
}

function setDisassemblyMode() {
  currentMode.value = 'Disassembly'
  sendToUnity('SetDisassemblyModeFromWeb')
}

onMounted(() => {
  window.addEventListener('message', handleUnityMessage)
})

onBeforeUnmount(() => {
  window.removeEventListener('message', handleUnityMessage)
})

function handleUnityMessage(event) {
  const data = event.data

  if (!data || data.source !== 'unity-pc-simulator') return

  if (data.type === 'UNITY_MODE_UPDATE') {
    currentMode.value = data.message
  }

  if (data.type === 'UNITY_STEP_UPDATE') {
    currentStepText.value = data.message
    currentPartId.value = data.partId || ''
  }

  if (data.type === 'UNITY_WARNING') {
    warningText.value = data.message
  }

  if (data.type === 'UNITY_CLEAR_WARNING') {
    warningText.value = ''
  }
}
</script>

<style scoped>
.pc-page {
  height: 100vh;
  background: #0f172a;
}

.fill-height {
  height: 100vh;
}

.unity-area {
  height: 100vh;
  background: #111827;
  display: flex;
}

.unity-frame {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}
.side-panel {
  height: 100vh;
  background: #f8fafc;
  overflow-y: auto;
}
</style>