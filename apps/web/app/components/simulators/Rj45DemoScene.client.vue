<script setup lang="ts">
import { computed, nextTick, shallowRef, watch } from 'vue'
import gsap from 'gsap'
import { Box3, Group, Object3D, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { useLoader } from '@tresjs/core'
import { OrbitControls } from '@tresjs/cientos'

type Vec3 = [number, number, number]

type Transform = {
  position: Vec3
  rotation: Vec3
}

type ModelPreset = {
  targetSize: number
  localRotation: Vec3
  localOffset: Vec3
}

const FLOOR_Y = -0.55
const TABLE_TOP_Y = 0.02
const TABLE_HEIGHT = 0.18
const TABLE_Y = TABLE_TOP_Y - TABLE_HEIGHT / 2
const BASE_Y = TABLE_TOP_Y

// const MODEL_PRESETS: Record<'cable' | 'plug' | 'tool', ModelPreset> = {
//   cable: {
//     targetSize: 1.2,
//     // keep the flatter look you were closest to
//     localRotation: [0, 4.87, 1.72],
//     // shift the cable mesh so its visible body sits more to the left of its wrapper origin
//     localOffset: [-0.9, 0, 0],
//   },
//   plug: {
//     targetSize: 0.52,
//     localRotation: [0, 0, 0],
//     localOffset: [0, 0, 0],
//   },
//   tool: {
//     targetSize: 2.0,
//     localRotation: [Math.PI / 2, 0, Math.PI / 2],
//     // shift the tool so its crimp head is closer to the wrapper origin
//     localOffset: [1.5, 0, 0],
//   },
// }

const MODEL_PRESETS: Record<'cable' | 'plug' | 'tool', ModelPreset> = {
  cable: {
    targetSize: 1.38,
    localRotation: [0, 4.87, 1.72],
    localOffset: [-0.9, 0, 0],
  },
  plug: {
    targetSize: 0.56,
    localRotation: [0, 0, 0],
    localOffset: [0, 0, 0],
  },
  tool: {
    targetSize: 2.1,
    localRotation: [Math.PI / 2, 0, Math.PI / 2],
    localOffset: [1.5, 0, 0],
  },
}

// const INITIAL_TRANSFORMS: Record<'cable' | 'plug' | 'tool', Transform> = {
//   cable: {
//     position: [-2.35, BASE_Y, 0.88],
//     rotation: [0, 0.42, 0],
//   },
//   plug: {
//     position: [0.10, BASE_Y, -0.92],
//     rotation: [0, Math.PI / 2, 0],
//   },
//   tool: {
//     position: [2.30, BASE_Y, 0.10],
//     rotation: [0, -1.2, 0],
//   },
// }

const INITIAL_TRANSFORMS: Record<'cable' | 'plug' | 'tool', Transform> = {
  cable: {
    position: [-2.15, BASE_Y, 0.82],
    rotation: [0, 0.42, 0],
  },
  plug: {
    position: [0.12, BASE_Y, -0.86],
    rotation: [0, Math.PI / 2, 0],
  },
  tool: {
    position: [2.05, BASE_Y, 0.12],
    rotation: [0, -1.2, 0],
  },
}

const stage = shallowRef(new Group())

const cableWrapper = new Group()
const plugWrapper = new Group()
const toolWrapper = new Group()

stage.value.add(cableWrapper)
stage.value.add(plugWrapper)
stage.value.add(toolWrapper)

const { state: cableModel, isLoading: cableLoading } = useLoader(
  GLTFLoader,
  '/models/rj45/ethernet-cable.glb'
)

const { state: plugModel, isLoading: plugLoading } = useLoader(
  GLTFLoader,
  '/models/rj45/rj-plug.glb'
)

const { state: toolModel, isLoading: toolLoading } = useLoader(
  GLTFLoader,
  '/models/rj45/crimping-tool.glb'
)

const isLoading = computed(() =>
  cableLoading.value || plugLoading.value || toolLoading.value
)

const isReady = computed(() =>
  cableWrapper.children.length > 0 &&
  plugWrapper.children.length > 0 &&
  toolWrapper.children.length > 0
)

function prepareModel(
  source: Object3D,
  targetSize: number,
  localRotation: Vec3,
  localOffset: Vec3
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

  // center around origin first
  root.position.x -= rawCenter.x
  root.position.y -= rawCenter.y
  root.position.z -= rawCenter.z

  // normalize size
  root.scale.setScalar(scale)
  root.updateMatrixWorld(true)

  // place on local ground
  const fittedBox = new Box3().setFromObject(root)
  root.position.y -= fittedBox.min.y
  root.updateMatrixWorld(true)

  // important: shift visible mesh relative to wrapper origin
  root.position.x += localOffset[0]
  root.position.y += localOffset[1]
  root.position.z += localOffset[2]
  root.updateMatrixWorld(true)

  return root
}

function mountNormalizedModel(
  wrapper: Group,
  source: Object3D,
  preset: ModelPreset
) {
  wrapper.clear()
  const prepared = prepareModel(
    source,
    preset.targetSize,
    preset.localRotation,
    preset.localOffset
  )
  wrapper.add(prepared)
}

watch(
  cableModel,
  (value) => {
    if (value?.scene) {
      mountNormalizedModel(cableWrapper, value.scene, MODEL_PRESETS.cable)
    }
  },
  { immediate: true }
)

watch(
  plugModel,
  (value) => {
    if (value?.scene) {
      mountNormalizedModel(plugWrapper, value.scene, MODEL_PRESETS.plug)
    }
  },
  { immediate: true }
)

watch(
  toolModel,
  (value) => {
    if (value?.scene) {
      mountNormalizedModel(toolWrapper, value.scene, MODEL_PRESETS.tool)
    }
  },
  { immediate: true }
)

function setTransform(group: Group, transform: Transform) {
  group.position.set(...transform.position)
  group.rotation.set(...transform.rotation)
}

function killTweens() {
  ;[cableWrapper, plugWrapper, toolWrapper].forEach((group) => {
    gsap.killTweensOf(group.position)
    gsap.killTweensOf(group.rotation)
    gsap.killTweensOf(group.scale)
  })
}

function tween(
  target: Record<string, any>,
  vars: Record<string, any>,
  duration = 1
) {
  return new Promise<void>((resolve) => {
    gsap.to(target, {
      duration,
      ease: 'power2.inOut',
      ...vars,
      onComplete: () => resolve(),
    })
  })
}

async function resetScene() {
  await nextTick()
  if (!isReady.value) return

  killTweens()

  setTransform(cableWrapper, INITIAL_TRANSFORMS.cable)
  setTransform(plugWrapper, INITIAL_TRANSFORMS.plug)
  setTransform(toolWrapper, INITIAL_TRANSFORMS.tool)

  cableWrapper.scale.set(1, 1, 1)
  plugWrapper.scale.set(1, 1, 1)
  toolWrapper.scale.set(1, 1, 1)
}

async function playStep(step: number) {
  if (!isReady.value) return

  switch (step) {
    case 0: {
      await resetScene()
      break
    }

    case 1: {
      // cable moves in from left/back
      await Promise.all([
        tween(cableWrapper.position, { x: -1.05, y: BASE_Y, z: 0.26 }, 0.95),
        tween(cableWrapper.rotation, { x: 0, y: 0.10, z: 0 }, 0.95),
      ])
      break
    }

    case 2: {
      // plug moves from lower/front area toward center
      await Promise.all([
        tween(plugWrapper.position, { x: 0.10, y: BASE_Y, z: -0.06 }, 0.85),
        tween(plugWrapper.rotation, { y: Math.PI / 2 }, 0.85),
      ])
      break
    }

    case 3: {
      // cable approaches plug
      await Promise.all([
        tween(cableWrapper.position, { x: -0.20, y: BASE_Y, z: 0.02 }, 1.0),
        tween(cableWrapper.rotation, { x: 0, y: 0.04, z: 0 }, 1.0),
      ])
      break
    }

    case 4: {
      // tool comes in from right
      await Promise.all([
        tween(toolWrapper.position, { x: 1.10, y: BASE_Y + 0.26, z: -0.10 }, 0.9),
        tween(toolWrapper.rotation, { y: -0.28 }, 0.9),
      ])

      await Promise.all([
        tween(toolWrapper.position, { y: BASE_Y + 0.10 }, 0.28),
        tween(plugWrapper.scale, { x: 1.04, y: 0.96, z: 1.04 }, 0.18),
      ])

      await tween(plugWrapper.scale, { x: 1, y: 1, z: 1 }, 0.18)
      await tween(toolWrapper.position, { y: BASE_Y + 0.26 }, 0.28)
      break
    }

    case 5: {
      // final spaced presentation
      await Promise.all([
        tween(toolWrapper.position, { x: 1.75, y: BASE_Y + 0.03, z: -0.18 }, 0.8),
        tween(toolWrapper.rotation, { y: -0.62 }, 0.8),
        tween(cableWrapper.position, { x: -0.50, y: BASE_Y, z: 0.12 }, 0.8),
        tween(plugWrapper.position, { x: 0.22, y: BASE_Y, z: 0.02 }, 0.8),
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
  { immediate: true }
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

    <TresCanvas clear-color="#081226" shadows>
      <TresPerspectiveCamera :position="[0, 1.78, 7.75]" :fov="32" />

      <OrbitControls
        :target="[0, 0.08, 0]"
        :enable-pan="false"
        :min-distance="4"
        :max-distance="12"
      />

      <TresAmbientLight :intensity="1.7" />

      <TresDirectionalLight
        :position="[5, 7, 4]"
        :intensity="2.1"
        cast-shadow
      />

      <TresDirectionalLight
        :position="[-3, 2, -2]"
        :intensity="0.75"
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
        <TresMeshStandardMaterial color="#5e7697" :roughness="0.84" />
      </TresMesh>

      <primitive :object="stage" />
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