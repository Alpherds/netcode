<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { definePageMeta, navigateTo, useFetch, useRoute } from '#imports'
import DailyMeetingEmbed from '~/components/DailyMeetingEmbed.vue'

definePageMeta({
  middleware: 'auth',
})

type SessionStatus = 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED'

type ClassroomRef = {
  id?: number
  title?: string
  code?: string
  term?: string
}

type SessionItem = {
  id: number
  documentId?: string
  title?: string | null
  starts_at?: string | null
  ends_at?: string | null
  room_name?: string | null
  meeting_provider?: string | null
  meeting_status?: SessionStatus | null
  notes?: string | null
  classroom?: ClassroomRef | null
}

type ProfileItem = {
  id: number
  display_name?: string | null
  role_label?: string | null
}

type DailyJoinInfo = {
  roomUrl: string
  roomName: string
  token: string
  displayName: string
  isOwner: boolean
}

type AttendanceStudent = {
  id?: number
  display_name?: string | null
  student_no?: string | null
  auth_user_id?: number
}

type AttendanceItem = {
  id: number
  documentId?: string
  join_time?: string | null
  leave_time?: string | null
  attendance_status?: string | null
  source?: string | null
  student?: AttendanceStudent | null
}

type AttendanceMutationResult = {
  tracked: boolean
  reason?: string
}

const route = useRoute()
const sessionId = route.params.id as string

const {
  data: session,
  pending,
  error,
  refresh,
} = await useFetch<SessionItem>(`/api/sessions/${sessionId}`)

const { data: profile } = await useFetch<ProfileItem>('/api/profile')

const isUpdatingStatus = ref(false)
const isPreparingMeeting = ref(false)
const statusMessage = ref('')
const statusError = ref('')
const showMeeting = ref(false)
const joinInfo = ref<DailyJoinInfo | null>(null)

const attendance = ref<AttendanceItem[]>([])
const attendanceLoading = ref(false)
const attendanceError = ref('')

let autoRefreshTimer: ReturnType<typeof setInterval> | null = null
let isPollingAttendance = false

const roleLabel = computed(() =>
  String(profile.value?.role_label || '').toUpperCase()
)

const isInstructor = computed(
  () => roleLabel.value === 'INSTRUCTOR' || roleLabel.value === 'ADMIN'
)

const isStudent = computed(() => roleLabel.value === 'STUDENT')

const studentAttendance = computed(() => attendance.value[0] || null)

const refreshSession = async () => {
  await refresh()
}

const refreshAttendance = async () => {
  attendanceLoading.value = true
  attendanceError.value = ''

  try {
    attendance.value = await $fetch<AttendanceItem[]>(
      `/api/sessions/${sessionId}/attendance`
    )
  } catch (error: any) {
    attendanceError.value =
      error?.data?.message ||
      error?.statusMessage ||
      'Failed to load attendance.'
  } finally {
    attendanceLoading.value = false
  }
}

if (!error.value) {
  await refreshAttendance()
}

const classroomLabel = computed(() => {
  const c = session.value?.classroom
  if (!c) return 'No classroom linked'
  return [c.title, c.code, c.term].filter(Boolean).join(' · ')
})

const canStart = computed(
  () => isInstructor.value && session.value?.meeting_status === 'SCHEDULED'
)

const canEnd = computed(
  () => isInstructor.value && session.value?.meeting_status === 'LIVE'
)

const isLive = computed(() => session.value?.meeting_status === 'LIVE')
const isScheduled = computed(() => session.value?.meeting_status === 'SCHEDULED')
const isEnded = computed(() => session.value?.meeting_status === 'ENDED')
const isCancelled = computed(() => session.value?.meeting_status === 'CANCELLED')

const attendanceCount = computed(() => attendance.value.length)

const presentCount = computed(
  () =>
    attendance.value.filter(
      (item) => String(item.attendance_status || '').toUpperCase() === 'PRESENT'
    ).length
)

const leftCount = computed(
  () =>
    attendance.value.filter(
      (item) => String(item.attendance_status || '').toUpperCase() === 'LEFT'
    ).length
)

const canEnterMeeting = computed(() => {
  if (!isLive.value) return false
  return isInstructor.value || isStudent.value
})

const accessTitle = computed(() => {
  if (isScheduled.value) {
    return isStudent.value
      ? 'Waiting for the instructor'
      : 'Session has not started yet'
  }

  if (isEnded.value) {
    return 'Session has ended'
  }

  if (isCancelled.value) {
    return 'Session was cancelled'
  }

  if (isLive.value) {
    return 'Meeting is live'
  }

  return 'Meeting unavailable'
})

const accessMessage = computed(() => {
  if (isScheduled.value) {
    return isStudent.value
      ? 'Your instructor has not started this session yet. Come back once it becomes live.'
      : 'Start the session to allow students to enter the meeting room.'
  }

  if (isEnded.value) {
    return isStudent.value
      ? 'This session is already closed and can no longer be joined.'
      : 'The live meeting is closed. You can still review the session details and attendance.'
  }

  if (isCancelled.value) {
    return 'This meeting room is unavailable because the session was cancelled.'
  }

  if (isLive.value) {
    return isStudent.value
      ? 'This session is live. You can enter when ready.'
      : 'The meeting room is active and ready for participants.'
  }

  return 'This meeting is unavailable right now.'
})

const formatDateTime = (value?: string | null) => {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

const goBack = async () => {
  const classroomId = session.value?.classroom?.id

  if (classroomId) {
    await navigateTo(`/classes/${classroomId}`)
    return
  }

  await navigateTo('/')
}

const updateStatus = async (nextStatus: SessionStatus, silent = false) => {
  statusMessage.value = ''
  statusError.value = ''
  isUpdatingStatus.value = true

  try {
    const updated = await $fetch<SessionItem>(`/api/sessions/${sessionId}/status`, {
      method: 'POST',
      body: {
        meeting_status: nextStatus,
      },
    })

    session.value = {
      ...updated,
      classroom: updated.classroom ?? session.value?.classroom ?? null,
    }

    if (nextStatus !== 'LIVE') {
      showMeeting.value = false
      joinInfo.value = null
    }

    if (!silent) {
      statusMessage.value = `Session marked as ${nextStatus}.`
    }

    await refreshAttendance()
  } catch (error: any) {
    statusError.value =
      error?.data?.message ||
      error?.statusMessage ||
      'Failed to update session status.'
  } finally {
    isUpdatingStatus.value = false
  }
}

const startSession = async () => {
  await updateStatus('LIVE')
}

const endSession = async () => {
  await updateStatus('ENDED')
}

const enterMeeting = async () => {
  statusMessage.value = ''
  statusError.value = ''
  isPreparingMeeting.value = true

  try {
    const payload = await $fetch<DailyJoinInfo>(`/api/sessions/${sessionId}/daily-join`)
    joinInfo.value = payload
    showMeeting.value = true
  } catch (error: any) {
    statusError.value =
      error?.data?.message ||
      error?.statusMessage ||
      'Failed to prepare Daily room.'
  } finally {
    isPreparingMeeting.value = false
  }
}

const markJoinAttendance = async () => {
  try {
    const result = await $fetch<AttendanceMutationResult>(
      `/api/sessions/${sessionId}/attendance`,
      {
        method: 'POST',
      }
    )

    if (result.tracked) {
      await refreshAttendance()
    }
  } catch (error: any) {
    statusError.value =
      error?.data?.message ||
      error?.statusMessage ||
      'Failed to log attendance.'
  }
}

const markLeaveAttendance = async () => {
  try {
    const result = await $fetch<AttendanceMutationResult>(
      `/api/sessions/${sessionId}/attendance`,
      {
        method: 'PUT',
      }
    )

    if (result.tracked) {
      await refreshAttendance()
    }
  } catch (error: any) {
    statusError.value =
      error?.data?.message ||
      error?.statusMessage ||
      'Failed to update attendance.'
  }
}

const onMeetingJoined = async () => {
  await markJoinAttendance()
}

const onMeetingClosed = async () => {
  await markLeaveAttendance()
  showMeeting.value = false
  joinInfo.value = null
}

const startAutoRefresh = () => {
  if (autoRefreshTimer) return

  autoRefreshTimer = setInterval(async () => {
    if (isPollingAttendance) return

    isPollingAttendance = true

    try {
      await refreshAttendance()
    } finally {
      isPollingAttendance = false
    }
  }, 10000)
}

const stopAutoRefresh = () => {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer)
    autoRefreshTimer = null
  }
}

watch(
  () => session.value?.meeting_status,
  (status) => {
    if (status === 'LIVE') {
      startAutoRefresh()
    } else {
      stopAutoRefresh()
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  stopAutoRefresh()
})

const sessionErrorMessage = computed(() => {
  const err: any = error.value

  if (err?.statusCode === 403) {
    return isStudent.value
      ? 'You are not allowed to access this session.'
      : 'You do not have access to this session.'
  }

  return 'Failed to load session.'
})
</script>

<template>
  <div class="page">
    <header class="hero">
      <div>
        <button class="back-btn" @click="goBack">← Back</button>
        <h1>{{ session?.title || 'Session Room' }}</h1>
        <p class="subtitle">{{ classroomLabel }}</p>
      </div>

      <div class="hero-actions">
        <button
          v-if="canStart"
          class="btn btn-success"
          :disabled="isUpdatingStatus"
          @click="startSession"
        >
          {{ isUpdatingStatus ? 'Updating...' : 'Start Session' }}
        </button>

        <button
          v-if="canEnd"
          class="btn btn-danger"
          :disabled="isUpdatingStatus"
          @click="endSession"
        >
          {{ isUpdatingStatus ? 'Updating...' : 'End Session' }}
        </button>

        <button class="btn" @click="refreshSession">Refresh</button>
      </div>
    </header>

    <section v-if="pending" class="panel">
      Loading session...
    </section>

    <section v-else-if="error" class="panel error">
      {{ sessionErrorMessage }}
    </section>

    <template v-else>
      <section class="panel summary-panel">
        <div class="summary-grid">
          <div class="summary-item">
            <span class="summary-label">Room</span>
            <strong>{{ session?.room_name || '—' }}</strong>
          </div>

          <div class="summary-item">
            <span class="summary-label">Status</span>
            <strong>{{ session?.meeting_status || '—' }}</strong>
          </div>

          <div class="summary-item">
            <span class="summary-label">Start</span>
            <strong>{{ formatDateTime(session?.starts_at) }}</strong>
          </div>

          <div class="summary-item">
            <span class="summary-label">End</span>
            <strong>{{ formatDateTime(session?.ends_at) }}</strong>
          </div>

          <div class="summary-item">
            <span class="summary-label">Provider</span>
            <strong>{{ session?.meeting_provider || '—' }}</strong>
          </div>

          <div class="summary-item">
            <span class="summary-label">Notes</span>
            <strong>{{ session?.notes || 'No notes provided.' }}</strong>
          </div>
        </div>

        <p v-if="statusMessage" class="status-message success">
          {{ statusMessage }}
        </p>

        <p v-if="statusError" class="status-message error-message">
          {{ statusError }}
        </p>
      </section>

      <section class="panel meeting-panel">
        <div class="panel-header">
          <h2>Live Meeting</h2>
          <span class="room-chip">
            {{ session?.room_name || 'No room name' }}
          </span>
        </div>

        <div
          v-if="isScheduled || isCancelled || isEnded"
          class="meeting-state-card"
          :class="{
            danger: isCancelled,
            neutral: isEnded,
          }"
        >
          <h3>{{ accessTitle }}</h3>
          <p>{{ accessMessage }}</p>
        </div>

        <div v-else-if="isLive && !showMeeting" class="meeting-entry-card">
          <div>
            <h3>{{ accessTitle }}</h3>
            <p>{{ accessMessage }}</p>
          </div>

          <button
            v-if="canEnterMeeting"
            class="btn btn-primary"
            :disabled="isPreparingMeeting"
            @click="enterMeeting"
          >
            {{ isPreparingMeeting ? 'Preparing room...' : 'Enter Meeting' }}
          </button>
        </div>

        <ClientOnly v-else-if="isLive && showMeeting">
          <DailyMeetingEmbed
            v-if="joinInfo"
            :room-url="joinInfo.roomUrl"
            :token="joinInfo.token"
            @joined="onMeetingJoined"
            @closed="onMeetingClosed"
          />

          <template #fallback>
            <div class="panel">Loading meeting...</div>
          </template>
        </ClientOnly>

        <div v-if="!session?.room_name" class="panel error">
          This session has no room name yet.
        </div>
      </section>

      <section class="panel attendance-panel">
        <div class="panel-header attendance-header">
          <div>
            <h2>Attendance</h2>
            <p class="attendance-subtitle">
              {{
                isInstructor
                  ? 'Live attendance updates every 10 seconds while the session is active.'
                  : 'Your attendance is recorded automatically when you join and leave the session.'
              }}
            </p>
          </div>

          <div v-if="isInstructor" class="attendance-chips">
            <span class="room-chip">Total {{ attendanceCount }}</span>
            <span class="attendance-chip present-chip">Present {{ presentCount }}</span>
            <span class="attendance-chip left-chip">Left {{ leftCount }}</span>
          </div>
        </div>

        <div v-if="attendanceLoading" class="attendance-empty">
          Loading attendance...
        </div>

        <div v-else-if="attendanceError" class="attendance-empty error-lite">
          {{ attendanceError }}
        </div>

        <div v-else-if="!attendance.length" class="attendance-empty">
          No attendance records yet.
        </div>

        <div v-else-if="isInstructor" class="attendance-list">
          <div v-for="item in attendance" :key="item.id" class="attendance-row">
            <div>
              <strong>{{ item.student?.display_name || 'Unknown student' }}</strong>
              <p>{{ item.student?.student_no || 'No student number' }}</p>
            </div>

            <div>
              <span class="attendance-label">Joined</span>
              <strong>{{ formatDateTime(item.join_time) }}</strong>
            </div>

            <div>
              <span class="attendance-label">Left</span>
              <strong>{{ formatDateTime(item.leave_time) }}</strong>
            </div>

            <div>
              <span class="attendance-label">Status</span>
              <strong>{{ item.attendance_status || '—' }}</strong>
            </div>
          </div>
        </div>

        <div v-else-if="studentAttendance" class="student-attendance-card">
          <div class="student-attendance-item">
            <span class="attendance-label">Joined</span>
            <strong>{{ formatDateTime(studentAttendance.join_time) }}</strong>
          </div>

          <div class="student-attendance-item">
            <span class="attendance-label">Left</span>
            <strong>{{ formatDateTime(studentAttendance.leave_time) }}</strong>
          </div>

          <div class="student-attendance-item">
            <span class="attendance-label">Status</span>
            <strong>{{ studentAttendance.attendance_status || '—' }}</strong>
          </div>
        </div>

        <div v-else class="attendance-empty">
          Your attendance record will appear here after you join the session.
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  padding: 32px 24px 48px;
  background: #f6f8fb;
  color: #1f2937;
}

.hero {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 24px;
}

.hero h1 {
  margin: 10px 0 6px;
  font-size: 34px;
}

.subtitle {
  margin: 0;
  color: #6b7280;
}

.hero-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.back-btn {
  border: 0;
  background: transparent;
  color: #4f46e5;
  font-weight: 700;
  cursor: pointer;
  padding: 0;
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

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-success {
  background: #15803d;
  color: white;
}

.btn-danger {
  background: #dc2626;
  color: white;
}

.panel {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  padding: 22px;
  margin-bottom: 20px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.summary-item {
  border: 1px solid #eef2f7;
  background: #f9fbff;
  border-radius: 14px;
  padding: 14px;
}

.summary-label,
.attendance-label {
  display: block;
  margin-bottom: 8px;
  font-size: 12px;
  color: #6b7280;
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0.06em;
}

.status-message {
  margin-top: 16px;
  padding: 12px 14px;
  border-radius: 12px;
  font-weight: 600;
}

.success {
  background: #ecfdf5;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.error-message {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
}

.meeting-panel {
  margin-top: 12px;
  padding: 18px;
}

.meeting-panel :deep(iframe) {
  display: block;
  width: 100%;
  height: 100%;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}

.panel-header h2 {
  margin: 0;
}

.room-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 7px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  background: #eef2ff;
  color: #4338ca;
  white-space: nowrap;
}

.meeting-state-card,
.meeting-entry-card {
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  padding: 22px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
}

.meeting-state-card h3,
.meeting-entry-card h3 {
  margin: 0 0 8px;
  font-size: 22px;
}

.meeting-state-card p,
.meeting-entry-card p {
  margin: 0;
  color: #6b7280;
}

.meeting-entry-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.meeting-state-card.danger {
  border-color: #fecaca;
  background: #fef2f2;
}

.meeting-state-card.neutral {
  border-color: #e5e7eb;
  background: #f9fafb;
}

.attendance-panel {
  padding: 18px;
}

.attendance-header {
  align-items: flex-start;
}

.attendance-subtitle {
  margin: 6px 0 0;
  color: #6b7280;
  font-size: 14px;
}

.attendance-chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.attendance-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 7px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.present-chip {
  background: #ecfdf5;
  color: #166534;
}

.left-chip {
  background: #fef3c7;
  color: #92400e;
}

.attendance-empty {
  border: 1px dashed #d1d5db;
  border-radius: 16px;
  padding: 24px;
  text-align: center;
  color: #6b7280;
}

.error-lite {
  color: #b91c1c;
  border-color: #fecaca;
  background: #fef2f2;
}

.attendance-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.attendance-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 16px;
  border: 1px solid #eef2f7;
  background: #f9fbff;
  border-radius: 16px;
  padding: 16px;
}

.attendance-row p {
  margin: 6px 0 0;
  color: #6b7280;
}

.student-attendance-card {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.student-attendance-item {
  border: 1px solid #eef2f7;
  background: #f9fbff;
  border-radius: 16px;
  padding: 16px;
}

.error {
  color: #b91c1c;
  border-color: #fecaca;
  background: #fef2f2;
}

@media (max-width: 900px) {
  .page {
    padding: 20px 14px 32px;
  }

  .hero {
    flex-direction: column;
  }

  .summary-grid,
  .student-attendance-card {
    grid-template-columns: 1fr;
  }

  .panel-header,
  .meeting-entry-card,
  .attendance-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .meeting-panel,
  .attendance-panel {
    padding: 14px;
  }

  .attendance-row {
    grid-template-columns: 1fr;
  }
}
</style>