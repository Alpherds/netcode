<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { definePageMeta, navigateTo, useFetch, useRoute } from '#imports'
import EnrollmentManager from '~/components/EnrollmentManager.vue'

definePageMeta({
  middleware: 'auth',
})

type Classroom = {
  id: number
  title?: string | null
  code?: string | null
  description?: string | null
  term?: string | null
  class_status?: 'OPEN' | 'CLOSED' | 'ARCHIVED' | string | null
}

type ProfileItem = {
  id: number
  display_name?: string | null
  role_label?: string | null
}

type SessionItem = {
  id: number
  title?: string | null
  starts_at?: string | null
  ends_at?: string | null
  room_name?: string | null
  meeting_provider?: string | null
  meeting_status?: 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED' | string | null
  notes?: string | null
}

type CreateSessionForm = {
  title: string
  starts_at: string
  ends_at: string
  room_name: string
  meeting_provider: 'DAILY'
  meeting_status: 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED'
  notes: string
}

type SessionFilter = 'ALL' | 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED'

type EditClassroomForm = {
  title: string
  code: string
  description: string
  term: string
}

const route = useRoute()
const classroomId = route.params.id as string

const { data: profile } = await useFetch<ProfileItem>('/api/profile')

const {
  data: classroom,
  pending: classroomPending,
  error: classroomError,
  refresh: refreshClassroom,
} = await useFetch<Classroom>(`/api/classrooms/${classroomId}`)

const {
  data: sessions,
  pending: sessionsPending,
  error: sessionsError,
  refresh: refreshSessions,
} = await useFetch<SessionItem[]>(`/api/classrooms/${classroomId}/sessions`)

const roleLabel = computed(() =>
  String(profile.value?.role_label || '').toUpperCase()
)

const isInstructor = computed(
  () => roleLabel.value === 'INSTRUCTOR' || roleLabel.value === 'ADMIN'
)

const isStudent = computed(() => roleLabel.value === 'STUDENT')

const canManageEnrollments = computed(
  () => roleLabel.value === 'INSTRUCTOR' || roleLabel.value === 'ADMIN'
)

const canEditClassroom = computed(
  () => roleLabel.value === 'INSTRUCTOR' || roleLabel.value === 'ADMIN'
)

const classroomStatus = computed(() =>
  String(classroom.value?.class_status || '').toUpperCase()
)

const isOpenClassroom = computed(() => classroomStatus.value === 'OPEN')
const isArchivedClassroom = computed(() => classroomStatus.value === 'ARCHIVED')

const safeSessions = computed(() => sessions.value ?? [])

const currentSessionFilter = ref<SessionFilter>('ALL')
const sessionSearch = ref('')

const liveSessionsCount = computed(() =>
  safeSessions.value.filter(
    (item) => String(item.meeting_status || '').toUpperCase() === 'LIVE'
  ).length
)

const scheduledSessionsCount = computed(() =>
  safeSessions.value.filter(
    (item) => String(item.meeting_status || '').toUpperCase() === 'SCHEDULED'
  ).length
)

const endedSessionsCount = computed(() =>
  safeSessions.value.filter(
    (item) => String(item.meeting_status || '').toUpperCase() === 'ENDED'
  ).length
)

const cancelledSessionsCount = computed(() =>
  safeSessions.value.filter(
    (item) => String(item.meeting_status || '').toUpperCase() === 'CANCELLED'
  ).length
)

const filteredSessions = computed(() => {
  const byStatus =
    currentSessionFilter.value === 'ALL'
      ? safeSessions.value
      : safeSessions.value.filter(
          (item) =>
            String(item.meeting_status || '').toUpperCase() ===
            currentSessionFilter.value
        )

  const keyword = sessionSearch.value.trim().toLowerCase()

  if (!keyword) return byStatus

  return byStatus.filter((item) => {
    return (
      String(item.title || '').toLowerCase().includes(keyword) ||
      String(item.room_name || '').toLowerCase().includes(keyword) ||
      String(item.notes || '').toLowerCase().includes(keyword) ||
      String(item.meeting_status || '').toLowerCase().includes(keyword)
    )
  })
})

const sessionFilterLabel = computed(() => {
  switch (currentSessionFilter.value) {
    case 'SCHEDULED':
      return 'scheduled'
    case 'LIVE':
      return 'live'
    case 'ENDED':
      return 'ended'
    case 'CANCELLED':
      return 'cancelled'
    default:
      return 'all'
  }
})

const showCreateDialog = ref(false)
const isSubmitting = ref(false)
const formError = ref('')
const formSuccess = ref('')

const showEditClassroomDialog = ref(false)
const isSavingClassroom = ref(false)
const editClassroomError = ref('')
const editClassroomSuccess = ref('')

const pageAlertType = ref<'success' | 'error' | 'info' | 'warning'>('success')
const pageAlertMessage = ref('')
const showPageAlert = ref(false)

const form = ref<CreateSessionForm>({
  title: '',
  starts_at: '',
  ends_at: '',
  room_name: '',
  meeting_provider: 'DAILY',
  meeting_status: 'SCHEDULED',
  notes: '',
})

const editClassroomForm = ref<EditClassroomForm>({
  title: '',
  code: '',
  description: '',
  term: '',
})

let autoRefreshTimer: ReturnType<typeof setInterval> | null = null
let pageAlertTimer: ReturnType<typeof setTimeout> | null = null

const showAlert = (
  type: 'success' | 'error' | 'info' | 'warning',
  message: string
) => {
  pageAlertType.value = type
  pageAlertMessage.value = message
  showPageAlert.value = true

  if (pageAlertTimer) {
    clearTimeout(pageAlertTimer)
  }

  pageAlertTimer = setTimeout(() => {
    showPageAlert.value = false
  }, 3000)
}

const syncEditClassroomForm = () => {
  editClassroomForm.value = {
    title: classroom.value?.title || '',
    code: classroom.value?.code || '',
    description: classroom.value?.description || '',
    term: classroom.value?.term || '',
  }
}

const resetForm = () => {
  form.value = {
    title: '',
    starts_at: '',
    ends_at: '',
    room_name: '',
    meeting_provider: 'DAILY',
    meeting_status: 'SCHEDULED',
    notes: '',
  }

  formError.value = ''
  formSuccess.value = ''
}

const openCreateDialog = () => {
  if (!isInstructor.value || !isOpenClassroom.value) return
  resetForm()
  showCreateDialog.value = true
}

const closeCreateDialog = () => {
  showCreateDialog.value = false
  resetForm()
}

const openEditClassroomDialog = () => {
  if (!canEditClassroom.value || isArchivedClassroom.value) return
  syncEditClassroomForm()
  editClassroomError.value = ''
  editClassroomSuccess.value = ''
  showEditClassroomDialog.value = true
}

const closeEditClassroomDialog = () => {
  showEditClassroomDialog.value = false
}

const submitSession = async () => {
  formError.value = ''
  formSuccess.value = ''

  if (!isOpenClassroom.value) {
    formError.value = 'You can only create sessions for an OPEN classroom.'
    return
  }

  if (!form.value.title.trim()) {
    formError.value = 'Session title is required.'
    return
  }

  if (!form.value.starts_at || !form.value.ends_at) {
    formError.value = 'Start and end date/time are required.'
    return
  }

  isSubmitting.value = true

  try {
    await $fetch(`/api/classrooms/${classroomId}/sessions`, {
      method: 'POST' as const,
      body: form.value,
    })

    formSuccess.value = 'Session created successfully.'
    await refreshSessions()
    closeCreateDialog()
    showAlert('success', 'Session created successfully.')
  } catch (error: any) {
    formError.value =
      error?.data?.message ||
      error?.statusMessage ||
      'Failed to create session.'
  } finally {
    isSubmitting.value = false
  }
}

const submitEditClassroom = async () => {
  editClassroomError.value = ''
  editClassroomSuccess.value = ''

  if (!editClassroomForm.value.title.trim()) {
    editClassroomError.value = 'Classroom title is required.'
    return
  }

  if (!editClassroomForm.value.code.trim()) {
    editClassroomError.value = 'Classroom code is required.'
    return
  }

  if (!editClassroomForm.value.term.trim()) {
    editClassroomError.value = 'Term is required.'
    return
  }

  isSavingClassroom.value = true

  try {
    const updated = await $fetch<Classroom>(`/api/classrooms/${classroomId}`, {
      method: 'PUT',
      body: {
        title: editClassroomForm.value.title,
        code: editClassroomForm.value.code,
        description: editClassroomForm.value.description,
        term: editClassroomForm.value.term,
      },
    })

    classroom.value = updated
    editClassroomSuccess.value = 'Classroom updated successfully.'
    closeEditClassroomDialog()
    await refreshClassroom()
    showAlert('success', 'Classroom updated successfully.')
  } catch (error: any) {
    editClassroomError.value =
      error?.data?.message ||
      error?.statusMessage ||
      'Failed to update classroom.'
  } finally {
    isSavingClassroom.value = false
  }
}

const goBack = async () => {
  await navigateTo('/')
}

const formatDateTime = (value?: string | null) => {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

const badgeColor = (status?: string | null) => {
  switch (String(status || '').toUpperCase()) {
    case 'SCHEDULED':
      return 'info'
    case 'LIVE':
      return 'success'
    case 'ENDED':
      return 'grey'
    case 'CANCELLED':
      return 'error'
    default:
      return 'grey'
  }
}

const classroomStatusColor = computed(() => {
  switch (String(classroom.value?.class_status || '').toUpperCase()) {
    case 'OPEN':
      return 'success'
    case 'CLOSED':
      return 'warning'
    case 'ARCHIVED':
      return 'grey'
    default:
      return 'grey'
  }
})

const statusLabel = (status?: string | null) => {
  switch (String(status || '').toUpperCase()) {
    case 'SCHEDULED':
      return 'Waiting to start'
    case 'LIVE':
      return 'Live now'
    case 'ENDED':
      return 'Ended'
    case 'CANCELLED':
      return 'Cancelled'
    default:
      return status || 'Unknown'
  }
}

const sessionHint = (status?: string | null) => {
  switch (String(status || '').toUpperCase()) {
    case 'SCHEDULED':
      return 'Students can enter after the instructor starts the session.'
    case 'LIVE':
      return 'This session is active and ready to enter.'
    case 'ENDED':
      return 'This session is already finished.'
    case 'CANCELLED':
      return 'This session is unavailable.'
    default:
      return 'Session status unavailable.'
  }
}

const openSession = async (id: number) => {
  await navigateTo(`/sessions/${id}`)
}

const classroomErrorMessage = computed(() => {
  const err: any = classroomError.value

  if (err?.statusCode === 403) {
    return isStudent.value
      ? 'You are not enrolled in this classroom.'
      : 'You do not have access to this classroom.'
  }

  return 'Failed to load classroom.'
})

const sessionsErrorMessage = computed(() => {
  const err: any = sessionsError.value

  if (err?.statusCode === 403) {
    return isStudent.value
      ? 'You are not allowed to view sessions for this classroom.'
      : 'You do not have access to this session list.'
  }

  return 'Failed to load sessions.'
})

const startAutoRefresh = () => {
  if (autoRefreshTimer) return

  autoRefreshTimer = setInterval(async () => {
    if (document.hidden) return
    await Promise.allSettled([refreshClassroom(), refreshSessions()])
  }, 20000)
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

  if (pageAlertTimer) {
    clearTimeout(pageAlertTimer)
    pageAlertTimer = null
  }
})
</script>

<template>
  <v-container fluid class="classroom-page pa-4 pa-md-6">
    <v-alert
      v-if="showPageAlert"
      v-model="showPageAlert"
      :type="pageAlertType"
      closable
      variant="tonal"
      class="mb-4"
    >
      {{ pageAlertMessage }}
    </v-alert>

    <v-alert
      v-if="classroomPending"
      type="info"
      variant="tonal"
      class="mb-4"
    >
      Loading classroom...
    </v-alert>

    <v-alert
      v-else-if="classroomError"
      type="error"
      variant="tonal"
      class="mb-4"
    >
      {{ classroomErrorMessage }}
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
              Back to Dashboard
            </v-btn>

            <v-chip
              :color="classroomStatusColor"
              variant="tonal"
              rounded="pill"
              size="large"
            >
              {{ classroom?.class_status || 'UNKNOWN' }}
            </v-chip>
          </div>

          <div class="d-flex flex-column flex-lg-row justify-space-between align-start ga-6">
            <div class="hero-copy">
              <div class="text-overline text-primary font-weight-bold mb-2">
                Classroom Space
              </div>

              <div class="text-h4 font-weight-bold mb-2">
                {{ classroom?.title || 'Classroom Details' }}
              </div>

              <div class="d-flex flex-wrap ga-2 mb-4">
                <v-chip color="primary" variant="outlined" rounded="pill">
                  {{ classroom?.code || 'No code' }}
                </v-chip>
                <v-chip color="grey-darken-1" variant="outlined" rounded="pill">
                  {{ classroom?.term || 'No term' }}
                </v-chip>
              </div>

              <p class="text-body-1 text-medium-emphasis mb-0">
                {{ classroom?.description || 'No description provided.' }}
              </p>
            </div>

            <div
              v-if="isInstructor"
              class="hero-action-stack d-flex flex-wrap ga-3 justify-end"
            >
              <v-btn
                color="primary"
                rounded="pill"
                size="large"
                prepend-icon="mdi-video-plus-outline"
                :disabled="!isOpenClassroom"
                @click="openCreateDialog"
              >
                Create Session
              </v-btn>

              <v-btn
                color="teal-darken-1"
                rounded="pill"
                size="large"
                prepend-icon="mdi-pencil-outline"
                :disabled="isArchivedClassroom"
                @click="openEditClassroomDialog"
              >
                Edit Classroom
              </v-btn>
            </div>
          </div>

          <v-alert
            v-if="!isOpenClassroom"
            type="warning"
            variant="tonal"
            class="mt-5"
          >
            {{
              isArchivedClassroom
                ? 'This classroom is archived. Sessions and enrollment changes are disabled.'
                : 'This classroom is closed. New sessions cannot be created until it is reopened elsewhere.'
            }}
          </v-alert>

          <v-alert
            v-if="isStudent"
            type="info"
            variant="tonal"
            class="mt-5"
          >
            You can only enter sessions that are currently marked as
            <strong>LIVE</strong>.
          </v-alert>

          <v-alert
            v-else
            type="success"
            variant="tonal"
            class="mt-5"
          >
            Start a session to allow enrolled students to enter the meeting room.
          </v-alert>
        </v-card-text>
      </v-card>

      <v-dialog v-model="showEditClassroomDialog" max-width="820">
        <v-card rounded="xl">
          <v-card-title class="text-h5 font-weight-bold pt-5 px-5">
            Edit Classroom
          </v-card-title>

          <v-card-text class="px-5 pt-3">
            <v-alert
              v-if="editClassroomError"
              type="error"
              variant="tonal"
              class="mb-4"
            >
              {{ editClassroomError }}
            </v-alert>

            <v-alert
              v-if="editClassroomSuccess"
              type="success"
              variant="tonal"
              class="mb-4"
            >
              {{ editClassroomSuccess }}
            </v-alert>

            <v-row dense>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="editClassroomForm.title"
                  label="Title"
                  rounded="xl"
                />
              </v-col>

              <v-col cols="12" md="6">
                <v-text-field
                  v-model="editClassroomForm.code"
                  label="Code"
                  rounded="xl"
                />
              </v-col>

              <v-col cols="12">
                <v-textarea
                  v-model="editClassroomForm.description"
                  label="Description"
                  rounded="xl"
                  rows="4"
                  auto-grow
                />
              </v-col>

              <v-col cols="12" md="6">
                <v-text-field
                  v-model="editClassroomForm.term"
                  label="Term"
                  rounded="xl"
                />
              </v-col>
            </v-row>
          </v-card-text>

          <v-card-actions class="px-5 pb-5">
            <v-spacer />
            <v-btn variant="text" rounded="pill" @click="closeEditClassroomDialog">
              Cancel
            </v-btn>
            <v-btn
              color="primary"
              rounded="pill"
              :loading="isSavingClassroom"
              @click="submitEditClassroom"
            >
              Save Changes
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-dialog v-model="showCreateDialog" max-width="920">
        <v-card rounded="xl">
          <v-card-title class="text-h5 font-weight-bold pt-5 px-5">
            Create Session
          </v-card-title>

          <v-card-text class="px-5 pt-3">
            <v-alert
              v-if="formError"
              type="error"
              variant="tonal"
              class="mb-4"
            >
              {{ formError }}
            </v-alert>

            <v-alert
              v-if="formSuccess"
              type="success"
              variant="tonal"
              class="mb-4"
            >
              {{ formSuccess }}
            </v-alert>

            <v-row dense>
              <v-col cols="12">
                <v-text-field
                  v-model="form.title"
                  label="Session Title"
                  rounded="xl"
                />
              </v-col>

              <v-col cols="12" md="6">
                <v-text-field
                  v-model="form.starts_at"
                  label="Start Date & Time"
                  type="datetime-local"
                  rounded="xl"
                />
              </v-col>

              <v-col cols="12" md="6">
                <v-text-field
                  v-model="form.ends_at"
                  label="End Date & Time"
                  type="datetime-local"
                  rounded="xl"
                />
              </v-col>

              <v-col cols="12" md="6">
                <v-text-field
                  v-model="form.room_name"
                  label="Room Name"
                  rounded="xl"
                />
              </v-col>

              <v-col cols="12" md="6">
                <v-select
                  v-model="form.meeting_status"
                  label="Meeting Status"
                  rounded="xl"
                  :items="['SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED']"
                />
              </v-col>

              <v-col cols="12">
                <v-textarea
                  v-model="form.notes"
                  label="Notes"
                  rounded="xl"
                  rows="4"
                  auto-grow
                />
              </v-col>
            </v-row>
          </v-card-text>

          <v-card-actions class="px-5 pb-5">
            <v-spacer />
            <v-btn variant="text" rounded="pill" @click="closeCreateDialog">
              Cancel
            </v-btn>
            <v-btn
              color="primary"
              rounded="pill"
              :loading="isSubmitting"
              @click="submitSession"
            >
              Save Session
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-card
        v-if="canManageEnrollments && !isArchivedClassroom"
        rounded="xl"
        elevation="3"
        class="section-card mb-6"
      >
        <v-card-text class="pa-5">
          <EnrollmentManager
            :classroom-id="classroomId"
            :can-manage="canManageEnrollments"
          />
        </v-card-text>
      </v-card>

      <v-card
        v-else-if="canManageEnrollments && isArchivedClassroom"
        rounded="xl"
        elevation="3"
        class="section-card mb-6"
      >
        <v-card-text class="pa-5">
          <v-alert type="warning" variant="tonal">
            Enrollment management is disabled for archived classrooms.
          </v-alert>
        </v-card-text>
      </v-card>

      <v-card rounded="xl" elevation="3" class="section-card">
        <v-card-text class="pa-5">
          <div class="d-flex flex-column flex-md-row justify-space-between align-start ga-3 mb-4">
            <div>
              <div class="text-h5 font-weight-bold">Sessions</div>
              <div class="text-body-2 text-medium-emphasis">
                Showing {{ filteredSessions.length }} of {{ safeSessions.length }} sessions
              </div>
            </div>

            <v-chip color="primary" variant="tonal" rounded="pill">
              {{ filteredSessions.length }}
            </v-chip>
          </div>

          <v-text-field
            v-model="sessionSearch"
            prepend-inner-icon="mdi-magnify"
            label="Search sessions"
            rounded="xl"
            hide-details
            class="mb-4"
          />

          <div class="filter-row mb-4">
            <v-chip
              :color="currentSessionFilter === 'ALL' ? 'primary' : undefined"
              :variant="currentSessionFilter === 'ALL' ? 'flat' : 'outlined'"
              rounded="pill"
              class="filter-chip"
              @click="currentSessionFilter = 'ALL'"
            >
              All
              <span class="chip-count">{{ safeSessions.length }}</span>
            </v-chip>

            <v-chip
              :color="currentSessionFilter === 'SCHEDULED' ? 'primary' : undefined"
              :variant="currentSessionFilter === 'SCHEDULED' ? 'flat' : 'outlined'"
              rounded="pill"
              class="filter-chip"
              @click="currentSessionFilter = 'SCHEDULED'"
            >
              Scheduled
              <span class="chip-count">{{ scheduledSessionsCount }}</span>
            </v-chip>

            <v-chip
              :color="currentSessionFilter === 'LIVE' ? 'primary' : undefined"
              :variant="currentSessionFilter === 'LIVE' ? 'flat' : 'outlined'"
              rounded="pill"
              class="filter-chip"
              @click="currentSessionFilter = 'LIVE'"
            >
              Live
              <span class="chip-count">{{ liveSessionsCount }}</span>
            </v-chip>

            <v-chip
              :color="currentSessionFilter === 'ENDED' ? 'primary' : undefined"
              :variant="currentSessionFilter === 'ENDED' ? 'flat' : 'outlined'"
              rounded="pill"
              class="filter-chip"
              @click="currentSessionFilter = 'ENDED'"
            >
              Ended
              <span class="chip-count">{{ endedSessionsCount }}</span>
            </v-chip>

            <v-chip
              :color="currentSessionFilter === 'CANCELLED' ? 'primary' : undefined"
              :variant="currentSessionFilter === 'CANCELLED' ? 'flat' : 'outlined'"
              rounded="pill"
              class="filter-chip"
              @click="currentSessionFilter = 'CANCELLED'"
            >
              Cancelled
              <span class="chip-count">{{ cancelledSessionsCount }}</span>
            </v-chip>
          </div>

          <div
            v-if="isStudent"
            class="d-flex flex-wrap ga-3 mb-4"
          >
            <v-sheet
              rounded="xl"
              color="success"
              variant="tonal"
              class="summary-box pa-4"
            >
              <div class="text-overline">Live</div>
              <div class="text-h5 font-weight-bold">{{ liveSessionsCount }}</div>
            </v-sheet>

            <v-sheet
              rounded="xl"
              color="info"
              variant="tonal"
              class="summary-box pa-4"
            >
              <div class="text-overline">Scheduled</div>
              <div class="text-h5 font-weight-bold">{{ scheduledSessionsCount }}</div>
            </v-sheet>
          </div>

          <v-alert
            v-if="sessionsPending"
            type="info"
            variant="tonal"
          >
            Loading sessions...
          </v-alert>

          <v-alert
            v-else-if="sessionsError"
            type="error"
            variant="tonal"
          >
            {{ sessionsErrorMessage }}
          </v-alert>

          <v-alert
            v-else-if="safeSessions.length === 0"
            type="info"
            variant="tonal"
          >
            {{
              isStudent
                ? 'No sessions are available for this classroom yet.'
                : 'No sessions yet. Create the first session to get started.'
            }}
          </v-alert>

          <v-alert
            v-else-if="filteredSessions.length === 0"
            type="info"
            variant="tonal"
          >
            No {{ sessionFilterLabel }} sessions found for this classroom.
          </v-alert>

          <v-row v-else dense>
            <v-col
              v-for="session in filteredSessions"
              :key="session.id"
              cols="12"
            >
              <v-card rounded="xl" elevation="2" class="session-card">
                <v-card-text class="pa-4 pa-md-5">
                  <div class="d-flex justify-space-between align-start flex-wrap ga-3 mb-4">
                    <div>
                      <div class="text-h6 font-weight-bold">
                        {{ session.title || 'Untitled Session' }}
                      </div>
                      <div class="text-body-2 text-primary font-weight-medium mt-1">
                        {{ session.room_name || 'No room name' }}
                      </div>
                    </div>

                    <v-chip
                      :color="badgeColor(session.meeting_status)"
                      variant="tonal"
                      rounded="pill"
                    >
                      {{ statusLabel(session.meeting_status) }}
                    </v-chip>
                  </div>

                  <v-row dense class="mb-3">
                    <v-col cols="12" md="6">
                      <v-sheet rounded="lg" color="surface-variant" class="pa-3">
                        <div class="text-caption text-medium-emphasis">Start</div>
                        <div class="font-weight-medium">
                          {{ formatDateTime(session.starts_at) }}
                        </div>
                      </v-sheet>
                    </v-col>

                    <v-col cols="12" md="6">
                      <v-sheet rounded="lg" color="surface-variant" class="pa-3">
                        <div class="text-caption text-medium-emphasis">End</div>
                        <div class="font-weight-medium">
                          {{ formatDateTime(session.ends_at) }}
                        </div>
                      </v-sheet>
                    </v-col>
                  </v-row>

                  <div class="text-body-2 text-medium-emphasis mb-2">
                    {{ session.notes || 'No notes provided.' }}
                  </div>

                  <div class="text-body-2 text-medium-emphasis mb-4">
                    {{ sessionHint(session.meeting_status) }}
                  </div>

                  <div class="d-flex justify-end">
                    <v-btn
                      color="primary"
                      rounded="pill"
                      prepend-icon="mdi-open-in-new"
                      @click="openSession(session.id)"
                    >
                      {{
                        String(session.meeting_status || '').toUpperCase() === 'LIVE'
                          ? 'Enter Session'
                          : 'View Session'
                      }}
                    </v-btn>
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>
    </template>
  </v-container>
</template>

<style scoped>
.classroom-page {
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
  max-width: 720px;
}

.hero-action-stack {
  min-width: 280px;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.filter-chip {
  cursor: pointer;
}

.chip-count {
  margin-left: 8px;
  font-weight: 700;
}

.summary-box {
  min-width: 150px;
}

.session-card {
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: linear-gradient(180deg, #ffffff 0%, #fbfcff 100%);
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

  .filter-row {
    flex-direction: column;
  }

  .filter-chip {
    justify-content: space-between;
  }
}
</style>