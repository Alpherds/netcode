<script setup lang="ts">
import { computed, nextTick, reactive, shallowRef, watch } from 'vue'
import gsap from 'gsap'
import { Box3, CatmullRomCurve3, Object3D, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { useLoader } from '@tresjs/core'
import { OrbitControls } from '@tresjs/cientos'

type Vec3 = [number, number, number]

type ModelPreset = {
  targetSize: number
  localRotation: Vec3
  localOffset: Vec3
}

type ModelTransform = {
  position: Vec3
  rotation: Vec3
}

type ModelState = {
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
  scale: { x: number; y: number; z: number }
}

type WireTarget = {
  offsetZ: number
  yaw: number
  exposed: number
}

type WireDefinition = {
  id: number
  baseColor: string
  stripeColor?: string
}

type WireState = {
  id: number
  baseColor: string
  stripeColor?: string
  striped: boolean
  offsetZ: number
  yaw: number
  exposed: number
  thickness: number
}

const FLOOR_Y = -0.55
const TABLE_TOP_Y = 0.02
const TABLE_HEIGHT = 0.18
const TABLE_Y = TABLE_TOP_Y - TABLE_HEIGHT / 2
const BASE_Y = TABLE_TOP_Y
const ACTION_Y = BASE_Y + 0.06
const ACTION_Z = 0.34

const MODEL_PRESETS: Record<'plug' | 'tool', ModelPreset> = {
  plug: {
    targetSize: 0.58,
    localRotation: [0, 0, 0],
    localOffset: [0, 0, 0],
  },
  tool: {
    targetSize: 2.05,
    localRotation: [Math.PI / 2, 0, Math.PI / 2],
    localOffset: [1.5, 0, 0],
  },
}

const INITIAL_MODEL_TRANSFORMS: Record<'plug' | 'tool', ModelTransform> = {
  plug: {
    position: [0.18, BASE_Y, ACTION_Z + 0.02],
    rotation: [0, Math.PI / 2, 0],
  },
  tool: {
    position: [2.15, BASE_Y, ACTION_Z + 0.20],
    rotation: [0, -1.05, 0],
  },
}

const plugObject = shallowRef<Object3D | null>(null)
const toolObject = shallowRef<Object3D | null>(null)

const plugState = createModelState(INITIAL_MODEL_TRANSFORMS.plug)
const toolState = createModelState(INITIAL_MODEL_TRANSFORMS.tool)

const cableBody = reactive({
  startX: -3.25,
  endX: -1.46,
  y: ACTION_Y,
  z: ACTION_Z,
  radius: 0.105,
})

const stripRing = reactive({
  x: -1.60,
  y: ACTION_Y,
  z: ACTION_Z,
  visible: false,
})

/**
 * T568B order:
 * 1 white-orange
 * 2 orange
 * 3 white-green
 * 4 blue
 * 5 white-blue
 * 6 green
 * 7 white-brown
 * 8 brown
 */
const wireDefinitions: WireDefinition[] = [
  { id: 0, baseColor: '#f5f5f5', stripeColor: '#f28c28' },
  { id: 1, baseColor: '#f28c28' },
  { id: 2, baseColor: '#f5f5f5', stripeColor: '#47b84a' },
  { id: 3, baseColor: '#4b7cff' },
  { id: 4, baseColor: '#f5f5f5', stripeColor: '#4b7cff' },
  { id: 5, baseColor: '#47b84a' },
  { id: 6, baseColor: '#f5f5f5', stripeColor: '#8a5b3d' },
  { id: 7, baseColor: '#8a5b3d' },
]

const initialOffsets = [-0.055, -0.040, -0.026, -0.010, 0.010, 0.026, 0.040, 0.055]

const wires: WireState[] = wireDefinitions.map((wire, index) =>
  reactive({
    id: wire.id,
    baseColor: wire.baseColor,
    stripeColor: wire.stripeColor,
    striped: Boolean(wire.stripeColor),
    offsetZ: initialOffsets[index]!,
    yaw: 0,
    exposed: 0.02,
    thickness: 0.024,
  }),
)

const { state: plugModel, isLoading: plugLoading } = useLoader(
  GLTFLoader,
  '/models/rj45/rj-plug.glb',
)

const { state: toolModel, isLoading: toolLoading } = useLoader(
  GLTFLoader,
  '/models/rj45/crimping-tool.glb',
)

const isLoading = computed(() => plugLoading.value || toolLoading.value)
const isReady = computed(() => Boolean(plugObject.value && toolObject.value))

function createModelState(transform: ModelTransform): ModelState {
  return reactive({
    position: {
      x: transform.position[0],
      y: transform.position[1],
      z: transform.position[2],
    },
    rotation: {
      x: transform.rotation[0],
      y: transform.rotation[1],
      z: transform.rotation[2],
    },
    scale: {
      x: 1,
      y: 1,
      z: 1,
    },
  })
}

function prepareModel(
  source: Object3D,
  targetSize: number,
  localRotation: Vec3,
  localOffset: Vec3,
) {
  const root = source.clone(true)

  root.traverse((child: any) => {
    if (child?.isMesh) {
      child.castShadow = true
      child.receiveShadow = true
    }
  })

  root.rotation.set(...localRotation)
  root.updateMatrixWorld(true)

  const rawBox = new Box3().setFromObject(root)
  const rawSize = new Vector3()
  const rawCenter = new Vector3()

  rawBox.getSize(rawSize)
  rawBox.getCenter(rawCenter)

  const maxAxis = Math.max(rawSize.x, rawSize.y, rawSize.z) || 1
  const scale = targetSize / maxAxis

  root.position.x -= rawCenter.x
  root.position.y -= rawCenter.y
  root.position.z -= rawCenter.z

  root.scale.setScalar(scale)
  root.updateMatrixWorld(true)

  const fittedBox = new Box3().setFromObject(root)
  root.position.y -= fittedBox.min.y
  root.updateMatrixWorld(true)

  root.position.x += localOffset[0]
  root.position.y += localOffset[1]
  root.position.z += localOffset[2]
  root.updateMatrixWorld(true)

  return root
}

watch(
  plugModel,
  (value) => {
    if (value?.scene) {
      plugObject.value = prepareModel(
        value.scene,
        MODEL_PRESETS.plug.targetSize,
        MODEL_PRESETS.plug.localRotation,
        MODEL_PRESETS.plug.localOffset,
      )
    }
  },
  { immediate: true },
)

watch(
  toolModel,
  (value) => {
    if (value?.scene) {
      toolObject.value = prepareModel(
        value.scene,
        MODEL_PRESETS.tool.targetSize,
        MODEL_PRESETS.tool.localRotation,
        MODEL_PRESETS.tool.localOffset,
      )
    }
  },
  { immediate: true },
)

function applyModelTransform(state: ModelState, transform: ModelTransform) {
  state.position.x = transform.position[0]
  state.position.y = transform.position[1]
  state.position.z = transform.position[2]

  state.rotation.x = transform.rotation[0]
  state.rotation.y = transform.rotation[1]
  state.rotation.z = transform.rotation[2]

  state.scale.x = 1
  state.scale.y = 1
  state.scale.z = 1
}

function buildTargets(
  exposed: number[],
  zOffsets: number[],
  yaws: number[],
): WireTarget[] {
  return zOffsets.map((offset, index) => ({
    offsetZ: offset,
    yaw: yaws[index] ?? 0,
    exposed: exposed[index]!,
  }))
}

function makeReadyWireTargets(): WireTarget[] {
  return buildTargets(
    [0.018, 0.018, 0.018, 0.018, 0.018, 0.018, 0.018, 0.018],
    [-0.055, -0.040, -0.026, -0.010, 0.010, 0.026, 0.040, 0.055],
    [0, 0, 0, 0, 0, 0, 0, 0],
  )
}

function makeStrippedWireTargets(): WireTarget[] {
  return buildTargets(
    [0.42, 0.40, 0.40, 0.38, 0.38, 0.40, 0.40, 0.42],
    [-0.10, -0.075, -0.045, -0.015, 0.015, 0.045, 0.075, 0.10],
    [-0.18, -0.13, -0.08, -0.04, 0.04, 0.08, 0.13, 0.18],
  )
}

function makeOrganizedWireTargets(): WireTarget[] {
  return buildTargets(
    [0.62, 0.62, 0.62, 0.62, 0.62, 0.62, 0.62, 0.62],
    [-0.092, -0.066, -0.040, -0.014, 0.014, 0.040, 0.066, 0.092],
    [0, 0, 0, 0, 0, 0, 0, 0],
  )
}

function makeTrimmedWireTargets(): WireTarget[] {
  return buildTargets(
    [0.26, 0.26, 0.26, 0.26, 0.26, 0.26, 0.26, 0.26],
    [-0.088, -0.063, -0.038, -0.013, 0.013, 0.038, 0.063, 0.088],
    [0, 0, 0, 0, 0, 0, 0, 0],
  )
}

function makeInsertedWireTargets(): WireTarget[] {
  return buildTargets(
    [0.18, 0.18, 0.18, 0.18, 0.18, 0.18, 0.18, 0.18],
    [-0.082, -0.058, -0.034, -0.010, 0.010, 0.034, 0.058, 0.082],
    [0, 0, 0, 0, 0, 0, 0, 0],
  )
}

function makeFinishedWireTargets(): WireTarget[] {
  return buildTargets(
    [0.16, 0.16, 0.16, 0.16, 0.16, 0.16, 0.16, 0.16],
    [-0.080, -0.057, -0.034, -0.011, 0.011, 0.034, 0.057, 0.080],
    [0, 0, 0, 0, 0, 0, 0, 0],
  )
}

const cableCurve = computed(() => {
  const startX = cableBody.startX
  const endX = cableBody.endX
  const length = endX - startX

  return new CatmullRomCurve3([
    new Vector3(startX, cableBody.y - 0.015, cableBody.z - 0.03),
    new Vector3(startX + length * 0.22, cableBody.y + 0.06, cableBody.z - 0.015),
    new Vector3(startX + length * 0.55, cableBody.y - 0.02, cableBody.z + 0.005),
    new Vector3(endX, cableBody.y, cableBody.z),
  ])
})

const cableStartCap = computed(() => cableCurve.value.getPoint(0))
const cableEndCap = computed(() => cableCurve.value.getPoint(1))

function killTweens() {
  gsap.killTweensOf(cableBody)
  gsap.killTweensOf(stripRing)

  gsap.killTweensOf(plugState.position)
  gsap.killTweensOf(plugState.rotation)
  gsap.killTweensOf(plugState.scale)

  gsap.killTweensOf(toolState.position)
  gsap.killTweensOf(toolState.rotation)
  gsap.killTweensOf(toolState.scale)

  wires.forEach((wire) => {
    gsap.killTweensOf(wire)
  })
}

function tween(
  target: Record<string, any>,
  vars: Record<string, any>,
  duration = 1,
  ease = 'power2.inOut',
) {
  return new Promise<void>((resolve) => {
    gsap.to(target, {
      duration,
      ease,
      ...vars,
      onComplete: () => resolve(),
    })
  })
}

function applyWires(targets: WireTarget[]) {
  wires.forEach((wire, index) => {
    const target = targets[index]!
    wire.offsetZ = target.offsetZ
    wire.yaw = target.yaw
    wire.exposed = target.exposed
  })
}

async function tweenWires(targets: WireTarget[], duration = 1) {
  await Promise.all(
    wires.map((wire, index) => {
      const target = targets[index]!
      return tween(
        wire,
        {
          offsetZ: target.offsetZ,
          yaw: target.yaw,
          exposed: target.exposed,
        },
        duration,
      )
    }),
  )
}

function setReadyCable() {
  cableBody.startX = -3.25
  cableBody.endX = -1.46
  cableBody.radius = 0.105

  stripRing.x = -1.60
  stripRing.y = ACTION_Y
  stripRing.z = ACTION_Z
  stripRing.visible = false
}

function setStrippedCable() {
  cableBody.startX = -3.00
  cableBody.endX = -1.46
  cableBody.radius = 0.105

  stripRing.x = -1.46
  stripRing.y = ACTION_Y
  stripRing.z = ACTION_Z
  stripRing.visible = true
}

function setOrganizedCable() {
  cableBody.startX = -2.10
  cableBody.endX = -0.98
  cableBody.radius = 0.105

  stripRing.visible = false
}

function setTrimmedCable() {
  cableBody.startX = -1.62
  cableBody.endX = -0.42
  cableBody.radius = 0.105

  stripRing.visible = false
}

function setInsertedCable() {
  cableBody.startX = -1.20
  cableBody.endX = -0.08
  cableBody.radius = 0.105

  stripRing.visible = false
}

function setFinishedCable() {
  cableBody.startX = -1.16
  cableBody.endX = -0.02
  cableBody.radius = 0.105

  stripRing.visible = false
}

async function resetScene() {
  await nextTick()
  if (!isReady.value) return

  killTweens()

  applyModelTransform(plugState, INITIAL_MODEL_TRANSFORMS.plug)
  applyModelTransform(toolState, INITIAL_MODEL_TRANSFORMS.tool)

  setReadyCable()
  applyWires(makeReadyWireTargets())
}

async function playStep(step: number) {
  if (!isReady.value) return

  switch (step) {
    case 0: {
      await resetScene()
      break
    }

    case 1: {
      setStrippedCable()
      await tweenWires(makeStrippedWireTargets(), 0.75)
      break
    }

    case 2: {
      setOrganizedCable()
      await Promise.all([
        tweenWires(makeOrganizedWireTargets(), 0.9),
        tween(plugState.position, { x: 0.18, y: BASE_Y, z: ACTION_Z + 0.02 }, 0.9),
      ])
      break
    }

    case 3: {
      setTrimmedCable()
      await tweenWires(makeTrimmedWireTargets(), 0.7)
      break
    }

    case 4: {
      setInsertedCable()
      await Promise.all([
        tweenWires(makeInsertedWireTargets(), 0.85),
        tween(plugState.position, { x: 0.16, y: BASE_Y, z: ACTION_Z + 0.02 }, 0.85),
      ])
      break
    }

    case 5: {
      setFinishedCable()

      await Promise.all([
        tween(toolState.position, { x: 0.98, y: BASE_Y + 0.26, z: ACTION_Z + 0.02 }, 0.8),
        tween(toolState.rotation, { x: 0, y: -0.22, z: -0.08 }, 0.8),
      ])

      await Promise.all([
        tween(toolState.position, { y: BASE_Y + 0.09, z: ACTION_Z + 0.01 }, 0.24, 'power1.in'),
        tween(toolState.rotation, { z: -0.18 }, 0.24, 'power1.in'),
        tween(plugState.scale, { x: 1.03, y: 0.96, z: 1.03 }, 0.18, 'power1.in'),
        tweenWires(makeFinishedWireTargets(), 0.24),
      ])

      await Promise.all([
        tween(toolState.position, { y: BASE_Y + 0.24 }, 0.22),
        tween(toolState.rotation, { z: -0.08 }, 0.22),
        tween(plugState.scale, { x: 1, y: 1, z: 1 }, 0.18),
      ])
      break
    }
  }
}

function stopScene() {
  killTweens()
}

watch(
  isReady,
  async (ready) => {
    if (ready) {
      await resetScene()
    }
  },
  { immediate: true },
)

defineExpose({
  resetScene,
  playStep,
  stopScene,
})
</script>

<template>
  <div class="scene-shell">
    <div v-if="isLoading" class="scene-overlay">
      Loading 3D assets...
    </div>

    <TresCanvas render-mode="always" clear-color="#081226" shadows>
      <TresPerspectiveCamera :position="[0, 1.72, 7.2]" :fov="30" />

      <OrbitControls
        :target="[0, 0.10, ACTION_Z]"
        :enable-pan="false"
        :min-distance="4"
        :max-distance="12"
      />

      <TresAmbientLight :intensity="1.8" />

      <TresDirectionalLight
        :position="[5, 7, 4]"
        :intensity="2.2"
        cast-shadow
      />

      <TresDirectionalLight
        :position="[-3, 2, -2]"
        :intensity="0.8"
      />

      <TresMesh
        :rotation="[-Math.PI / 2, 0, 0]"
        :position="[0, FLOOR_Y, 0]"
        receive-shadow
      >
        <TresPlaneGeometry :args="[24, 24]" />
        <TresMeshStandardMaterial color="#0b1324" />
      </TresMesh>

      <TresMesh
        :position="[0, TABLE_Y, 0]"
        receive-shadow
        cast-shadow
      >
        <TresBoxGeometry :args="[7.4, TABLE_HEIGHT, 4.2]" />
        <TresMeshStandardMaterial color="#94a8bc" :roughness="0.84" />
      </TresMesh>

      <!-- one continuous gray cable -->
      <TresMesh cast-shadow receive-shadow>
        <TresTubeGeometry :args="[cableCurve, 64, cableBody.radius, 18, false]" />
        <TresMeshStandardMaterial color="#c8c8c8" :roughness="0.68" />
      </TresMesh>

      <!-- cable caps -->
      <TresMesh
        :position="[cableStartCap.x, cableStartCap.y, cableStartCap.z]"
        cast-shadow
        receive-shadow
      >
        <TresSphereGeometry :args="[cableBody.radius, 18, 18]" />
        <TresMeshStandardMaterial color="#c8c8c8" :roughness="0.68" />
      </TresMesh>

      <TresMesh
        :position="[cableEndCap.x, cableEndCap.y, cableEndCap.z]"
        cast-shadow
        receive-shadow
      >
        <TresSphereGeometry :args="[cableBody.radius, 18, 18]" />
        <TresMeshStandardMaterial color="#c8c8c8" :roughness="0.68" />
      </TresMesh>

      <!-- strip mark -->
      <TresGroup
        v-if="stripRing.visible"
        :position="[stripRing.x, stripRing.y, stripRing.z]"
        :rotation="[0, Math.PI / 2, 0]"
      >
        <TresMesh cast-shadow receive-shadow>
          <TresTorusGeometry :args="[0.108, 0.008, 10, 32]" />
          <TresMeshStandardMaterial color="#2d2d2d" :roughness="0.9" />
        </TresMesh>
      </TresGroup>

      <!-- inner wires always anchored to cableBody.endX -->
      <TresGroup
        v-for="wire in wires"
        :key="wire.id"
        :position="[
          cableBody.endX + Math.cos(wire.yaw) * (wire.exposed / 2),
          ACTION_Y,
          ACTION_Z + wire.offsetZ + Math.sin(wire.yaw) * (wire.exposed / 2)
        ]"
        :rotation="[0, wire.yaw, Math.PI / 2]"
      >
        <TresMesh cast-shadow receive-shadow>
          <TresCylinderGeometry :args="[wire.thickness / 2, wire.thickness / 2, wire.exposed, 12]" />
          <TresMeshStandardMaterial :color="wire.baseColor" :roughness="0.42" />
        </TresMesh>

        <TresMesh
          v-if="wire.striped"
          :rotation="[0, 0, Math.PI / 4]"
          cast-shadow
          receive-shadow
        >
          <TresBoxGeometry :args="[wire.exposed, wire.thickness * 0.10, wire.thickness * 0.40]" />
          <TresMeshStandardMaterial :color="wire.stripeColor" :roughness="0.35" />
        </TresMesh>
      </TresGroup>

      <!-- RJ45 plug -->
      <TresGroup
        v-if="plugObject"
        :position="[plugState.position.x, plugState.position.y, plugState.position.z]"
        :rotation="[plugState.rotation.x, plugState.rotation.y, plugState.rotation.z]"
        :scale="[plugState.scale.x, plugState.scale.y, plugState.scale.z]"
      >
        <primitive :object="plugObject" />
      </TresGroup>

      <!-- crimp tool -->
      <TresGroup
        v-if="toolObject"
        :position="[toolState.position.x, toolState.position.y, toolState.position.z]"
        :rotation="[toolState.rotation.x, toolState.rotation.y, toolState.rotation.z]"
        :scale="[toolState.scale.x, toolState.scale.y, toolState.scale.z]"
      >
        <primitive :object="toolObject" />
      </TresGroup>
    </TresCanvas>
  </div>
</template>

<style scoped>
.scene-shell {
  position: relative;
  width: 100%;
  height: 620px;
  overflow: hidden;
  border-radius: 20px;
  background: #081226;
}

.scene-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: grid;
  place-items: center;
  background: rgba(8, 18, 38, 0.65);
  color: white;
  font-weight: 600;
}
</style>