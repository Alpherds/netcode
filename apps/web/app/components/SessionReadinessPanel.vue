<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { ref } from 'vue'

type ReadinessStudent = {
  id: number
  display_name?: string | null
  student_no?: string | null
  program?: string | null
  year_level?: string | null
  section?: string | null
}

type ReadinessRow = {
  student: ReadinessStudent
  readiness_state: 'WAITING' | 'JOINED' | 'LEFT'
  attendance_status?: string | null
  join_time?: string | null
  leave_time?: string | null
}

type ReadinessResponse = {
  totalEnrolled: number
  joinedCount: number
  waitingCount: number
  leftCount: number
  rows: ReadinessRow[]
}

const props = defineProps<{
  sessionId: string | number
  isLive: boolean
}>()

const readiness = ref<ReadinessResponse | null>(null)
const loading = ref(false)
const errorMessage = ref('')

let timer: ReturnType<typeof setInterval> | null = null
let isRefreshing = false

const rows = computed(() => readiness.value?.rows ?? [])

const formatDateTime = (value?: string | null) => {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

const studentInitial = (name?: string | null) =>
  String(name || 'S').trim().charAt(0).toUpperCase()

const studentMeta = (student: ReadinessStudent) => {
  return [
    student.student_no || 'No student number',
    student.program || '',
    student.year_level || '',
    student.section || '',
  ]
    .filter(Boolean)
    .join(' · ')
}

const readinessColor = (state: string) => {
  switch (state) {
    case 'JOINED':
      return 'success'
    case 'LEFT':
      return 'warning'
    default:
      return 'info'
  }
}

const loadReadiness = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    readiness.value = await $fetch<ReadinessResponse>(
      `/api/sessions/${props.sessionId}/readiness`
    )
  } catch (error: any) {
    errorMessage.value =
      error?.data?.message ||
      error?.statusMessage ||
      'Failed to load participant readiness.'
  } finally {
    loading.value = false
  }
}

const refreshReadiness = async () => {
  if (isRefreshing) return
  isRefreshing = true

  try {
    readiness.value = await $fetch<ReadinessResponse>(
      `/api/sessions/${props.sessionId}/readiness`
    )
  } catch {
    // silent refresh failure
  } finally {
    isRefreshing = false
  }
}

const startPolling = () => {
  if (timer) return

  timer = setInterval(async () => {
    if (document.hidden) return
    await refreshReadiness()
  }, 10000)
}

const stopPolling = () => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

watch(
  () => props.isLive,
  (value) => {
    if (value) {
      startPolling()
    } else {
      stopPolling()
    }
  },
  { immediate: true }
)

onMounted(async () => {
  await loadReadiness()
})

onBeforeUnmount(() => {
  stopPolling()
})
</script>

<template>
  <v-card rounded="xl" elevation="3" class="readiness-shell mb-6">
    <v-card-text class="pa-5">
      <div class="d-flex flex-column flex-md-row justify-space-between align-start ga-3 mb-4">
        <div>
          <div class="text-h5 font-weight-bold">Participant Readiness</div>
          <div class="text-body-2 text-medium-emphasis">
            Track who is enrolled, who has joined, and who is still waiting.
          </div>
        </div>

        <v-btn
          color="primary"
          variant="tonal"
          rounded="pill"
          prepend-icon="mdi-refresh"
          :loading="loading"
          @click="loadReadiness"
        >
          Refresh
        </v-btn>
      </div>

      <div v-if="readiness" class="d-flex flex-wrap ga-3 mb-4">
        <v-sheet rounded="xl" color="primary" variant="tonal" class="stat-box pa-4">
          <div class="text-overline">Total</div>
          <div class="text-h6 font-weight-bold">{{ readiness.totalEnrolled }}</div>
        </v-sheet>

        <v-sheet rounded="xl" color="success" variant="tonal" class="stat-box pa-4">
          <div class="text-overline">Joined</div>
          <div class="text-h6 font-weight-bold">{{ readiness.joinedCount }}</div>
        </v-sheet>

        <v-sheet rounded="xl" color="info" variant="tonal" class="stat-box pa-4">
          <div class="text-overline">Waiting</div>
          <div class="text-h6 font-weight-bold">{{ readiness.waitingCount }}</div>
        </v-sheet>

        <v-sheet rounded="xl" color="warning" variant="tonal" class="stat-box pa-4">
          <div class="text-overline">Left</div>
          <div class="text-h6 font-weight-bold">{{ readiness.leftCount }}</div>
        </v-sheet>
      </div>

      <div v-if="loading" class="empty-wrap">
        <v-progress-circular indeterminate color="primary" />
        <div class="mt-3 text-medium-emphasis">Loading participant readiness...</div>
      </div>

      <v-alert
        v-else-if="errorMessage"
        type="error"
        variant="tonal"
      >
        {{ errorMessage }}
      </v-alert>

      <v-alert
        v-else-if="!rows.length"
        type="info"
        variant="tonal"
      >
        No enrolled students found for this classroom.
      </v-alert>

      <v-row v-else dense>
        <v-col
          v-for="row in rows"
          :key="row.student.id"
          cols="12"
        >
          <v-card rounded="xl" elevation="1" class="readiness-card">
            <v-card-text class="pa-4">
              <div class="d-flex flex-column flex-lg-row justify-space-between align-start ga-4">
                <div class="d-flex align-center ga-3 min-w-0 readiness-student">
                  <v-avatar color="primary" variant="tonal" size="48">
                    {{ studentInitial(row.student.display_name) }}
                  </v-avatar>

                  <div class="min-w-0">
                    <div class="text-subtitle-1 font-weight-bold text-truncate">
                      {{ row.student.display_name || 'Unnamed student' }}
                    </div>
                    <div class="text-body-2 text-medium-emphasis">
                      {{ studentMeta(row.student) }}
                    </div>
                  </div>
                </div>

                <div class="readiness-meta-grid">
                  <v-sheet rounded="lg" color="surface-variant" class="pa-3 meta-box">
                    <div class="text-caption text-medium-emphasis mb-2">Joined</div>
                    <div class="font-weight-medium">
                      {{ formatDateTime(row.join_time) }}
                    </div>
                  </v-sheet>

                  <v-sheet rounded="lg" color="surface-variant" class="pa-3 meta-box">
                    <div class="text-caption text-medium-emphasis mb-2">Left</div>
                    <div class="font-weight-medium">
                      {{ formatDateTime(row.leave_time) }}
                    </div>
                  </v-sheet>

                  <div class="d-flex flex-column ga-2 justify-center">
                    <div class="text-caption text-medium-emphasis">State</div>
                    <div class="d-flex flex-wrap ga-2">
                      <v-chip
                        :color="readinessColor(row.readiness_state)"
                        variant="tonal"
                        rounded="pill"
                      >
                        {{ row.readiness_state }}
                      </v-chip>

                      <v-chip
                        v-if="row.attendance_status"
                        color="primary"
                        variant="outlined"
                        rounded="pill"
                      >
                        {{ row.attendance_status }}
                      </v-chip>
                    </div>
                  </div>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.readiness-shell {
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: rgba(255, 255, 255, 0.96);
}

.readiness-card {
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: linear-gradient(180deg, #ffffff 0%, #fbfcff 100%);
}

.stat-box {
  min-width: 130px;
}

.empty-wrap {
  padding: 28px;
  border: 1px dashed rgba(148, 163, 184, 0.4);
  border-radius: 20px;
  text-align: center;
  background: rgba(248, 250, 252, 0.9);
}

.min-w-0 {
  min-width: 0;
}

.readiness-meta-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  width: 100%;
  max-width: 720px;
}

.meta-box {
  min-height: 84px;
}

@media (max-width: 960px) {
  .readiness-meta-grid {
    grid-template-columns: 1fr;
    max-width: 100%;
  }

  .stat-box {
    flex: 1 1 calc(50% - 12px);
    min-width: 0;
  }
}
</style>