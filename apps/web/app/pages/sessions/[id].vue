<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { definePageMeta, navigateTo, useFetch, useRoute } from '#imports'
import DailyMeetingEmbed from '~/components/DailyMeetingEmbed.vue'
import SessionReadinessPanel from '~/components/SessionReadinessPanel.vue'

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
let isPolling = false

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
    const payload = await $fetch<DailyJoinInfo>(
      `/api/sessions/${sessionId}/daily-join`
    )
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
    if (document.hidden || isPolling) return

    isPolling = true

    try {
      if (showMeeting.value) {
        await refreshAttendance()
      } else {
        await Promise.allSettled([refreshSession(), refreshAttendance()])
      }
    } finally {
      isPolling = false
    }
  }, 15000)
}

const stopAutoRefresh = () => {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer)
    autoRefreshTimer = null
  }
}

onMounted(() => {
  startAutoRefresh()
})

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

const sessionStatusColor = computed(() => {
  switch (String(session.value?.meeting_status || '').toUpperCase()) {
    case 'LIVE':
      return 'success'
    case 'SCHEDULED':
      return 'info'
    case 'ENDED':
      return 'grey'
    case 'CANCELLED':
      return 'error'
    default:
      return 'grey'
  }
})
</script>

<template>
  <v-container fluid class="session-page pa-4 pa-md-6">
    <v-alert
      v-if="pending"
      type="info"
      variant="tonal"
      class="mb-4"
    >
      Loading session...
    </v-alert>

    <v-alert
      v-else-if="error"
      type="error"
      variant="tonal"
      class="mb-4"
    >
      {{ sessionErrorMessage }}
    </v-alert>

    <template v-else>
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
              Back to Classroom
            </v-btn>

            <div class="d-flex flex-wrap ga-3 align-center">
              <v-chip
                :color="sessionStatusColor"
                variant="tonal"
                rounded="pill"
                size="large"
              >
                {{ session?.meeting_status || 'UNKNOWN' }}
              </v-chip>

              <v-btn
                v-if="canStart"
                color="success"
                rounded="pill"
                size="large"
                prepend-icon="mdi-play-circle-outline"
                :loading="isUpdatingStatus"
                @click="startSession"
              >
                Start Session
              </v-btn>

              <v-btn
                v-if="canEnd"
                color="error"
                rounded="pill"
                size="large"
                prepend-icon="mdi-stop-circle-outline"
                :loading="isUpdatingStatus"
                @click="endSession"
              >
                End Session
              </v-btn>
            </div>
          </div>

          <div class="text-overline text-primary font-weight-bold mb-2">
            Session Space
          </div>

          <div class="text-h4 font-weight-bold mb-3">
            {{ session?.title || 'Session Room' }}
          </div>

          <div class="d-flex flex-wrap ga-2 mb-4">
            <v-chip color="primary" variant="outlined" rounded="pill">
              {{ session?.room_name || 'No room name' }}
            </v-chip>
            <v-chip color="grey-darken-1" variant="outlined" rounded="pill">
              {{ classroomLabel }}
            </v-chip>
          </div>

          <p class="text-body-1 text-medium-emphasis mb-0">
            {{ session?.notes || 'No notes provided.' }}
          </p>
        </v-card-text>
      </v-card>

      <v-alert
        v-if="statusMessage"
        type="success"
        variant="tonal"
        class="mb-4"
      >
        {{ statusMessage }}
      </v-alert>

      <v-alert
        v-if="statusError"
        type="error"
        variant="tonal"
        class="mb-4"
      >
        {{ statusError }}
      </v-alert>

      <v-row dense class="mb-6">
        <v-col cols="12" md="4">
          <v-sheet rounded="xl" color="surface" class="summary-tile pa-4">
            <div class="text-caption text-medium-emphasis mb-2">Room</div>
            <div class="font-weight-bold">{{ session?.room_name || '—' }}</div>
          </v-sheet>
        </v-col>

        <v-col cols="12" md="4">
          <v-sheet rounded="xl" color="surface" class="summary-tile pa-4">
            <div class="text-caption text-medium-emphasis mb-2">Start</div>
            <div class="font-weight-bold">{{ formatDateTime(session?.starts_at) }}</div>
          </v-sheet>
        </v-col>

        <v-col cols="12" md="4">
          <v-sheet rounded="xl" color="surface" class="summary-tile pa-4">
            <div class="text-caption text-medium-emphasis mb-2">End</div>
            <div class="font-weight-bold">{{ formatDateTime(session?.ends_at) }}</div>
          </v-sheet>
        </v-col>
      </v-row>

      <v-card rounded="xl" elevation="3" class="section-card mb-6">
        <v-card-text class="pa-5">
          <div class="d-flex justify-space-between align-start flex-wrap ga-3 mb-4">
            <div>
              <div class="text-h5 font-weight-bold">Live Meeting</div>
              <div class="text-body-2 text-medium-emphasis">
                Join the room once the session becomes live.
              </div>
            </div>

            <v-chip color="primary" variant="tonal" rounded="pill">
              {{ session?.room_name || 'No room name' }}
            </v-chip>
          </div>

          <v-alert
            v-if="!session?.room_name"
            type="error"
            variant="tonal"
            class="mb-4"
          >
            This session has no room name yet.
          </v-alert>

          <v-alert
            v-if="isScheduled"
            type="info"
            variant="tonal"
          >
            <strong>{{ accessTitle }}</strong><br />
            {{ accessMessage }}
          </v-alert>

          <v-alert
            v-else-if="isCancelled"
            type="error"
            variant="tonal"
          >
            <strong>{{ accessTitle }}</strong><br />
            {{ accessMessage }}
          </v-alert>

          <v-alert
            v-else-if="isEnded"
            type="warning"
            variant="tonal"
          >
            <strong>{{ accessTitle }}</strong><br />
            {{ accessMessage }}
          </v-alert>

          <v-sheet
            v-else-if="isLive && !showMeeting"
            rounded="xl"
            class="meeting-entry-sheet pa-5"
          >
            <div>
              <div class="text-h6 font-weight-bold mb-2">{{ accessTitle }}</div>
              <div class="text-body-2 text-medium-emphasis">
                {{ accessMessage }}
              </div>
            </div>

            <v-btn
              v-if="canEnterMeeting"
              color="primary"
              rounded="pill"
              size="large"
              prepend-icon="mdi-video-outline"
              :loading="isPreparingMeeting"
              @click="enterMeeting"
            >
              Enter Meeting
            </v-btn>
          </v-sheet>

          <ClientOnly v-else-if="isLive && showMeeting">
            <DailyMeetingEmbed
              v-if="joinInfo"
              :room-url="joinInfo.roomUrl"
              :token="joinInfo.token"
              @joined="onMeetingJoined"
              @closed="onMeetingClosed"
            />

            <template #fallback>
              <v-sheet rounded="xl" class="pa-6 text-center">
                Loading meeting...
              </v-sheet>
            </template>
          </ClientOnly>
        </v-card-text>
      </v-card>

      <SessionReadinessPanel
        v-if="isInstructor"
        :session-id="sessionId"
        :is-live="isLive"
      />

      <v-card rounded="xl" elevation="3" class="section-card">
        <v-card-text class="pa-5">
          <div class="d-flex justify-space-between align-start flex-wrap ga-3 mb-4">
            <div>
              <div class="text-h5 font-weight-bold">Attendance</div>
              <div class="text-body-2 text-medium-emphasis">
                {{
                  isInstructor
                    ? 'Attendance updates automatically while the session is active.'
                    : 'Your attendance is recorded automatically when you join and leave.'
                }}
              </div>
            </div>

            <div v-if="isInstructor" class="d-flex flex-wrap ga-2">
              <v-chip color="primary" variant="tonal" rounded="pill">
                Total {{ attendanceCount }}
              </v-chip>
              <v-chip color="success" variant="tonal" rounded="pill">
                Present {{ presentCount }}
              </v-chip>
              <v-chip color="warning" variant="tonal" rounded="pill">
                Left {{ leftCount }}
              </v-chip>
            </div>
          </div>

          <v-alert
            v-if="attendanceLoading"
            type="info"
            variant="tonal"
          >
            Loading attendance...
          </v-alert>

          <v-alert
            v-else-if="attendanceError"
            type="error"
            variant="tonal"
          >
            {{ attendanceError }}
          </v-alert>

          <v-alert
            v-else-if="!attendance.length"
            type="info"
            variant="tonal"
          >
            No attendance records yet.
          </v-alert>

          <v-row v-else-if="isInstructor" dense>
            <v-col
              v-for="item in attendance"
              :key="item.id"
              cols="12"
            >
              <v-card rounded="xl" elevation="1" class="attendance-card">
                <v-card-text class="pa-4">
                  <div class="d-flex flex-column flex-lg-row justify-space-between ga-4">
                    <div class="attendance-student">
                      <div class="text-subtitle-1 font-weight-bold">
                        {{ item.student?.display_name || 'Unknown student' }}
                      </div>
                      <div class="text-body-2 text-medium-emphasis">
                        {{ item.student?.student_no || 'No student number' }}
                      </div>
                    </div>

                    <div class="attendance-meta-grid">
                      <div>
                        <div class="text-caption text-medium-emphasis">Joined</div>
                        <div class="font-weight-medium">
                          {{ formatDateTime(item.join_time) }}
                        </div>
                      </div>

                      <div>
                        <div class="text-caption text-medium-emphasis">Left</div>
                        <div class="font-weight-medium">
                          {{ formatDateTime(item.leave_time) }}
                        </div>
                      </div>

                      <div>
                        <div class="text-caption text-medium-emphasis">Status</div>
                        <div class="font-weight-medium">
                          {{ item.attendance_status || '—' }}
                        </div>
                      </div>
                    </div>
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>

          <v-row v-else-if="studentAttendance" dense>
            <v-col cols="12" md="4">
              <v-sheet rounded="xl" color="surface-variant" class="pa-4">
                <div class="text-caption text-medium-emphasis mb-2">Joined</div>
                <div class="font-weight-bold">
                  {{ formatDateTime(studentAttendance.join_time) }}
                </div>
              </v-sheet>
            </v-col>

            <v-col cols="12" md="4">
              <v-sheet rounded="xl" color="surface-variant" class="pa-4">
                <div class="text-caption text-medium-emphasis mb-2">Left</div>
                <div class="font-weight-bold">
                  {{ formatDateTime(studentAttendance.leave_time) }}
                </div>
              </v-sheet>
            </v-col>

            <v-col cols="12" md="4">
              <v-sheet rounded="xl" color="surface-variant" class="pa-4">
                <div class="text-caption text-medium-emphasis mb-2">Status</div>
                <div class="font-weight-bold">
                  {{ studentAttendance.attendance_status || '—' }}
                </div>
              </v-sheet>
            </v-col>
          </v-row>

          <v-alert
            v-else
            type="info"
            variant="tonal"
          >
            Your attendance record will appear here after you join the session.
          </v-alert>
        </v-card-text>
      </v-card>
    </template>
  </v-container>
</template>

<style scoped>
.session-page {
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

.summary-tile {
  border: 1px solid rgba(15, 23, 42, 0.05);
}

.meeting-entry-sheet {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
}

.attendance-card {
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: linear-gradient(180deg, #ffffff 0%, #fbfcff 100%);
}

.attendance-meta-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  min-width: 420px;
}

@media (max-width: 960px) {
  .meeting-entry-sheet {
    flex-direction: column;
    align-items: flex-start;
  }

  .attendance-meta-grid {
    grid-template-columns: 1fr;
    min-width: 0;
  }
}
</style>