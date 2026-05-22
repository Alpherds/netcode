<template>
  <v-container fluid class="pa-0 pc-page">
    <v-row no-gutters class="fill-height">
      <v-col cols="9" class="unity-area">
        <iframe
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
          <div class="text-h6">Assembly / Disassembly</div>
        </v-card>

        <v-alert type="info" variant="tonal" class="mb-4">
          The simulator is running inside Unity WebGL.
        </v-alert>

        <v-btn block color="primary" size="large" class="mb-3">
          Assembly Mode
        </v-btn>

        <v-btn block color="secondary" size="large">
          Disassembly Mode
        </v-btn>
      </v-col>
    </v-row>
  </v-container>
</template>

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
}

.unity-frame {
  width: 100%;
  height: 100%;
  border: none;
}

.side-panel {
  height: 100vh;
  background: #f8fafc;
  overflow-y: auto;
}
</style>