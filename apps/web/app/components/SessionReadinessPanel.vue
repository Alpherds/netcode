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

const badgeClass = (state: string) => {
  switch (state) {
    case 'JOINED':
      return 'badge joined'
    case 'LEFT':
      return 'badge left'
    default:
      return 'badge waiting'
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
  <section class="panel">
    <div class="panel-header">
      <div>
        <h2>Participant Readiness</h2>
        <p class="panel-subtitle">
          Track who is enrolled, who has joined, and who is still waiting.
        </p>
      </div>

      <button class="btn" @click="loadReadiness">Refresh</button>
    </div>

    <div class="chips" v-if="readiness">
      <span class="chip total">Total {{ readiness.totalEnrolled }}</span>
      <span class="chip joined">Joined {{ readiness.joinedCount }}</span>
      <span class="chip waiting">Waiting {{ readiness.waitingCount }}</span>
      <span class="chip left">Left {{ readiness.leftCount }}</span>
    </div>

    <div v-if="loading" class="empty-state">
      Loading participant readiness...
    </div>

    <div v-else-if="errorMessage" class="empty-state error">
      {{ errorMessage }}
    </div>

    <div v-else-if="!rows.length" class="empty-state">
      No enrolled students found for this classroom.
    </div>

    <div v-else class="readiness-list">
      <article
        v-for="row in rows"
        :key="row.student.id"
        class="readiness-card"
      >
        <div>
          <strong>{{ row.student.display_name || 'Unnamed student' }}</strong>
          <p>
            {{ row.student.student_no || 'No student number' }}
            <span v-if="row.student.program"> · {{ row.student.program }}</span>
            <span v-if="row.student.year_level"> · {{ row.student.year_level }}</span>
            <span v-if="row.student.section"> · {{ row.student.section }}</span>
          </p>
        </div>

        <div class="meta">
          <div>
            <span class="meta-label">Joined</span>
            <strong>{{ formatDateTime(row.join_time) }}</strong>
          </div>

          <div>
            <span class="meta-label">Left</span>
            <strong>{{ formatDateTime(row.leave_time) }}</strong>
          </div>

          <div>
            <span class="meta-label">State</span>
            <span :class="badgeClass(row.readiness_state)">
              {{ row.readiness_state }}
            </span>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.panel {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  padding: 22px;
  margin-bottom: 20px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 18px;
}

.panel-header h2 {
  margin: 0;
}

.panel-subtitle {
  margin: 6px 0 0;
  color: #6b7280;
  font-size: 14px;
}

.chips {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 18px;
}

.chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 14px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.total {
  background: #eef2ff;
  color: #4338ca;
}

.joined {
  background: #ecfdf5;
  color: #166534;
}

.waiting {
  background: #eff6ff;
  color: #1d4ed8;
}

.left {
  background: #fef3c7;
  color: #92400e;
}

.readiness-list {
  display: grid;
  gap: 12px;
}

.readiness-card {
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 16px;
  background: #fcfdff;
  display: grid;
  grid-template-columns: 2fr 3fr;
  gap: 16px;
}

.readiness-card p {
  margin: 6px 0 0;
  color: #6b7280;
}

.meta {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.meta-label {
  display: block;
  margin-bottom: 8px;
  font-size: 12px;
  color: #6b7280;
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0.06em;
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 7px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.badge.joined {
  background: #dcfce7;
  color: #166534;
}

.badge.left {
  background: #fef3c7;
  color: #92400e;
}

.badge.waiting {
  background: #dbeafe;
  color: #1d4ed8;
}

.empty-state {
  padding: 22px;
  border: 1px dashed #d1d5db;
  border-radius: 16px;
  text-align: center;
  color: #6b7280;
  background: #fafafa;
}

.error {
  color: #b91c1c;
  border-color: #fecaca;
  background: #fef2f2;
}

.btn {
  border: 0;
  border-radius: 12px;
  padding: 10px 16px;
  background: #111827;
  color: white;
  font-weight: 600;
  cursor: pointer;
}

@media (max-width: 900px) {
  .panel-header,
  .readiness-card {
    grid-template-columns: 1fr;
    flex-direction: column;
  }

  .meta {
    grid-template-columns: 1fr;
  }

  .panel-header .btn {
    width: 100%;
  }
}
</style>