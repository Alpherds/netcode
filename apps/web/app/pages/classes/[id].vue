<script setup lang="ts">
import { computed, ref } from 'vue'
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

const canManageClassroomStatus = computed(
  () => roleLabel.value === 'INSTRUCTOR' || roleLabel.value === 'ADMIN'
)

const canEditClassroom = computed(
  () => roleLabel.value === 'INSTRUCTOR' || roleLabel.value === 'ADMIN'
)

const classroomStatus = computed(() =>
  String(classroom.value?.class_status || '').toUpperCase()
)

const isOpenClassroom = computed(() => classroomStatus.value === 'OPEN')
const isClosedClassroom = computed(() => classroomStatus.value === 'CLOSED')
const isArchivedClassroom = computed(() => classroomStatus.value === 'ARCHIVED')

const safeSessions = computed(() => sessions.value ?? [])
const liveSessions = computed(() =>
  safeSessions.value.filter(
    (item) => String(item.meeting_status || '').toUpperCase() === 'LIVE'
  )
)
const upcomingSessions = computed(() =>
  safeSessions.value.filter(
    (item) => String(item.meeting_status || '').toUpperCase() === 'SCHEDULED'
  )
)

const showCreateForm = ref(false)
const isSubmitting = ref(false)
const formError = ref('')
const formSuccess = ref('')

const updatingClassroomStatus = ref(false)
const classroomStatusError = ref('')
const classroomStatusSuccess = ref('')

const showEditClassroomForm = ref(false)
const isSavingClassroom = ref(false)
const editClassroomError = ref('')
const editClassroomSuccess = ref('')

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

const toggleCreateForm = () => {
  if (!isInstructor.value || !isOpenClassroom.value) return

  showCreateForm.value = !showCreateForm.value

  if (!showCreateForm.value) {
    resetForm()
  }
}

const toggleEditClassroomForm = () => {
  if (!canEditClassroom.value || isArchivedClassroom.value) return

  showEditClassroomForm.value = !showEditClassroomForm.value
  editClassroomError.value = ''
  editClassroomSuccess.value = ''

  if (showEditClassroomForm.value) {
    syncEditClassroomForm()
  }
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
    resetForm()
    showCreateForm.value = false
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
    const updateClassroomUrl: string = `/api/classrooms/${classroomId}`

    const updated = await $fetch<Classroom>(updateClassroomUrl, {
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
    showEditClassroomForm.value = false
    await refreshClassroom()
  } catch (error: any) {
    editClassroomError.value =
      error?.data?.message ||
      error?.statusMessage ||
      'Failed to update classroom.'
  } finally {
    isSavingClassroom.value = false
  }
}

const updateClassroomStatus = async (
  nextStatus: 'OPEN' | 'CLOSED' | 'ARCHIVED'
) => {
  classroomStatusError.value = ''
  classroomStatusSuccess.value = ''
  updatingClassroomStatus.value = true

  try {
    const updateStatusUrl: string = `/api/classrooms/${classroomId}/status`

    await $fetch(updateStatusUrl, {
      method: 'POST',
      body: {
        class_status: nextStatus,
      },
    })

    if (nextStatus !== 'OPEN') {
      showCreateForm.value = false
      resetForm()
    }

    if (nextStatus === 'ARCHIVED') {
      showEditClassroomForm.value = false
    }

    classroomStatusSuccess.value = `Classroom marked as ${nextStatus}.`
    await Promise.all([refreshClassroom(), refreshSessions()])
  } catch (error: any) {
    classroomStatusError.value =
      error?.data?.message ||
      error?.statusMessage ||
      'Failed to update classroom status.'
  } finally {
    updatingClassroomStatus.value = false
  }
}

const goBack = async () => {
  await navigateTo('/')
}

const refreshAll = async () => {
  await Promise.all([refreshClassroom(), refreshSessions()])
}

const formatDateTime = (value?: string | null) => {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

const badgeClass = (status?: string | null) => {
  switch (status) {
    case 'SCHEDULED':
      return 'badge badge-scheduled'
    case 'LIVE':
      return 'badge badge-live'
    case 'ENDED':
      return 'badge badge-ended'
    case 'CANCELLED':
      return 'badge badge-cancelled'
    default:
      return 'badge'
  }
}

const classroomStatusPillClass = (status?: string | null) => {
  switch (String(status || '').toUpperCase()) {
    case 'OPEN':
      return 'status-pill status-open'
    case 'CLOSED':
      return 'status-pill status-closed'
    case 'ARCHIVED':
      return 'status-pill status-archived'
    default:
      return 'status-pill'
  }
}

const statusLabel = (status?: string | null) => {
  switch (status) {
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
  switch (status) {
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
</script>

<template>
  <div class="page">
    <header class="hero">
      <div>
        <button class="back-btn" @click="goBack">← Back to Dashboard</button>
        <h1>{{ classroom?.title || 'Classroom Details' }}</h1>
        <p class="subtitle">
          {{ classroom?.code || 'No code' }} · {{ classroom?.term || 'No term' }}
        </p>
      </div>

      <div class="hero-actions">
        <button
          v-if="isInstructor"
          class="btn btn-secondary"
          :disabled="!isOpenClassroom"
          @click="toggleCreateForm"
        >
          {{
            isOpenClassroom
              ? (showCreateForm ? 'Close Form' : 'Create Session')
              : 'Classroom Not Open'
          }}
        </button>

        <button
          v-if="canEditClassroom"
          class="btn btn-edit"
          :disabled="isArchivedClassroom"
          @click="toggleEditClassroomForm"
        >
          {{
            isArchivedClassroom
              ? 'Archived Classroom'
              : (showEditClassroomForm ? 'Close Edit' : 'Edit Classroom')
          }}
        </button>

        <button class="btn" @click="refreshAll">Refresh</button>
      </div>
    </header>

    <section v-if="classroomPending" class="panel">
      Loading classroom...
    </section>

    <section v-else-if="classroomError" class="panel error">
      {{ classroomErrorMessage }}
    </section>

    <template v-else>
      <section class="panel">
        <div class="class-header">
          <div>
            <h2>{{ classroom?.title }}</h2>
            <p>{{ classroom?.description || 'No description provided.' }}</p>
          </div>

          <span :class="classroomStatusPillClass(classroom?.class_status)">
            {{ classroom?.class_status || 'UNKNOWN' }}
          </span>
        </div>

        <div
          v-if="canManageClassroomStatus"
          class="classroom-status-actions"
        >
          <button
            v-if="!isOpenClassroom"
            class="btn btn-open"
            :disabled="updatingClassroomStatus"
            @click="updateClassroomStatus('OPEN')"
          >
            {{ updatingClassroomStatus ? 'Updating...' : 'Open Classroom' }}
          </button>

          <button
            v-if="isOpenClassroom"
            class="btn btn-close"
            :disabled="updatingClassroomStatus"
            @click="updateClassroomStatus('CLOSED')"
          >
            {{ updatingClassroomStatus ? 'Updating...' : 'Close Classroom' }}
          </button>

          <button
            v-if="!isArchivedClassroom"
            class="btn btn-archive"
            :disabled="updatingClassroomStatus"
            @click="updateClassroomStatus('ARCHIVED')"
          >
            {{ updatingClassroomStatus ? 'Updating...' : 'Archive Classroom' }}
          </button>
        </div>

        <p v-if="classroomStatusError" class="form-message form-error">
          {{ classroomStatusError }}
        </p>

        <p v-if="classroomStatusSuccess" class="form-message form-success">
          {{ classroomStatusSuccess }}
        </p>

        <div v-if="!isOpenClassroom" class="classroom-status-notice">
          <strong>
            {{
              isArchivedClassroom
                ? 'This classroom is archived.'
                : 'This classroom is closed.'
            }}
          </strong>
          <p>
            New sessions cannot be created unless the classroom is set back to
            OPEN.
          </p>
        </div>

        <div v-if="isStudent" class="student-callout">
          <strong>Student View</strong>
          <p>
            You can only enter sessions that are currently marked as
            <strong>LIVE</strong>.
          </p>
        </div>

        <div v-else class="student-callout instructor-callout">
          <strong>Instructor View</strong>
          <p>
            Start a session to allow enrolled students to enter the meeting room.
          </p>
        </div>
      </section>

      <section
        v-if="showEditClassroomForm && canEditClassroom && !isArchivedClassroom"
        class="panel"
      >
        <div class="panel-header">
          <h2>Edit Classroom</h2>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label>Title</label>
            <input
              v-model="editClassroomForm.title"
              type="text"
              placeholder="Enter classroom title"
            />
          </div>

          <div class="form-group">
            <label>Code</label>
            <input
              v-model="editClassroomForm.code"
              type="text"
              placeholder="Enter classroom code"
            />
          </div>

          <div class="form-group full">
            <label>Description</label>
            <textarea
              v-model="editClassroomForm.description"
              rows="4"
              placeholder="Enter classroom description"
            />
          </div>

          <div class="form-group">
            <label>Term</label>
            <input
              v-model="editClassroomForm.term"
              type="text"
              placeholder="e.g. 1st Semester AY 2026-2027"
            />
          </div>
        </div>

        <p v-if="editClassroomError" class="form-message form-error">
          {{ editClassroomError }}
        </p>

        <p v-if="editClassroomSuccess" class="form-message form-success">
          {{ editClassroomSuccess }}
        </p>

        <div class="form-actions">
          <button
            class="btn btn-light"
            :disabled="isSavingClassroom"
            @click="syncEditClassroomForm"
          >
            Reset
          </button>

          <button
            class="btn btn-primary"
            :disabled="isSavingClassroom"
            @click="submitEditClassroom"
          >
            {{ isSavingClassroom ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>
      </section>

      <section
        v-if="showCreateForm && isInstructor && isOpenClassroom"
        class="panel"
      >
        <div class="panel-header">
          <h2>Create Session</h2>
        </div>

        <div class="form-grid">
          <div class="form-group full">
            <label>Session Title</label>
            <input
              v-model="form.title"
              type="text"
              placeholder="Enter session title"
            />
          </div>

          <div class="form-group">
            <label>Start Date & Time</label>
            <input v-model="form.starts_at" type="datetime-local" />
          </div>

          <div class="form-group">
            <label>End Date & Time</label>
            <input v-model="form.ends_at" type="datetime-local" />
          </div>

          <div class="form-group">
            <label>Room Name</label>
            <input
              v-model="form.room_name"
              type="text"
              placeholder="Optional room name"
            />
          </div>

          <div class="form-group">
            <label>Meeting Provider</label>
            <select v-model="form.meeting_provider">
              <option value="DAILY">DAILY</option>
            </select>
          </div>

          <div class="form-group">
            <label>Meeting Status</label>
            <select v-model="form.meeting_status">
              <option value="SCHEDULED">SCHEDULED</option>
              <option value="LIVE">LIVE</option>
              <option value="ENDED">ENDED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>

          <div class="form-group full">
            <label>Notes</label>
            <textarea
              v-model="form.notes"
              rows="4"
              placeholder="Optional notes"
            />
          </div>
        </div>

        <p v-if="formError" class="form-message form-error">
          {{ formError }}
        </p>

        <p v-if="formSuccess" class="form-message form-success">
          {{ formSuccess }}
        </p>

        <div class="form-actions">
          <button
            class="btn btn-light"
            :disabled="isSubmitting"
            @click="resetForm"
          >
            Reset
          </button>

          <button
            class="btn btn-primary"
            :disabled="isSubmitting"
            @click="submitSession"
          >
            {{ isSubmitting ? 'Creating...' : 'Save Session' }}
          </button>
        </div>
      </section>

<section v-if="canManageEnrollments && !isArchivedClassroom" class="panel">
  <EnrollmentManager
    :classroom-id="classroomId"
    :can-manage="canManageEnrollments"
  />
</section>

<section
  v-else-if="canManageEnrollments && isArchivedClassroom"
  class="panel"
>
  <div class="empty-state">
    Enrollment management is disabled for archived classrooms.
  </div>
</section>

      <section class="panel">
        <div class="panel-header">
          <h2>Sessions</h2>
          <span class="count">{{ safeSessions.length }}</span>
        </div>

        <div v-if="isStudent" class="session-summary-strip">
          <div class="summary-mini-card live-mini">
            <span>Live</span>
            <strong>{{ liveSessions.length }}</strong>
          </div>

          <div class="summary-mini-card scheduled-mini">
            <span>Scheduled</span>
            <strong>{{ upcomingSessions.length }}</strong>
          </div>
        </div>

        <div v-if="sessionsPending" class="empty-state">
          Loading sessions...
        </div>

        <div v-else-if="sessionsError" class="empty-state error">
          {{ sessionsErrorMessage }}
        </div>

        <div v-else-if="safeSessions.length === 0" class="empty-state">
          {{
            isStudent
              ? 'No sessions are available for this classroom yet.'
              : 'No sessions yet. Create the first session to get started.'
          }}
        </div>

        <div v-else class="session-list">
          <article
            v-for="session in safeSessions"
            :key="session.id"
            class="session-card"
          >
            <div class="session-top">
              <div>
                <h3>{{ session.title || 'Untitled Session' }}</h3>
                <p>{{ session.room_name || 'No room name' }}</p>
              </div>

              <span :class="badgeClass(session.meeting_status)">
                {{ statusLabel(session.meeting_status) }}
              </span>
            </div>

            <div class="session-meta">
              <p><strong>Start:</strong> {{ formatDateTime(session.starts_at) }}</p>
              <p><strong>End:</strong> {{ formatDateTime(session.ends_at) }}</p>
              <p><strong>Provider:</strong> {{ session.meeting_provider || '—' }}</p>
            </div>

            <p class="notes">{{ session.notes || 'No notes provided.' }}</p>
            <p class="session-hint">{{ sessionHint(session.meeting_status) }}</p>

            <div class="session-actions">
              <button
                class="btn btn-primary"
                @click="openSession(session.id)"
              >
                {{
                  String(session.meeting_status || '').toUpperCase() === 'LIVE'
                    ? 'Enter Session'
                    : 'View Session'
                }}
              </button>
            </div>
          </article>
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
  font-weight: 600;
  cursor: pointer;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #111827;
  color: white;
}

.btn-secondary {
  background: #4f46e5;
  color: white;
}

.btn-light {
  background: #e5e7eb;
  color: #111827;
}

.btn-open {
  background: #15803d;
  color: #ffffff;
}

.btn-close {
  background: #d97706;
  color: #ffffff;
}

.btn-archive {
  background: #6b7280;
  color: #ffffff;
}

.btn-edit {
  background: #0f766e;
  color: #ffffff;
}

.panel {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  padding: 22px;
  margin-bottom: 20px;
}

.class-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.class-header h2 {
  margin: 0 0 8px;
}

.status-pill,
.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 7px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  background: #e5e7eb;
  color: #374151;
  white-space: nowrap;
}

.status-open {
  background: #dcfce7;
  color: #166534;
}

.status-closed {
  background: #fef3c7;
  color: #92400e;
}

.status-archived {
  background: #e5e7eb;
  color: #374151;
}

.badge-scheduled {
  background: #dbeafe;
  color: #1d4ed8;
}

.badge-live {
  background: #dcfce7;
  color: #166534;
}

.badge-ended {
  background: #e5e7eb;
  color: #374151;
}

.badge-cancelled {
  background: #fee2e2;
  color: #991b1b;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
}

.panel-header h2 {
  margin: 0;
}

.count {
  min-width: 36px;
  height: 36px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #eef2ff;
  color: #4338ca;
  font-weight: 700;
}

.classroom-status-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin: 14px 0 0;
}

.classroom-status-notice {
  margin: 16px 0;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid #fde68a;
  background: #fffbeb;
  color: #92400e;
}

.classroom-status-notice strong {
  display: block;
  margin-bottom: 6px;
}

.classroom-status-notice p {
  margin: 0;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group.full {
  grid-column: 1 / -1;
}

.form-group label {
  font-size: 14px;
  font-weight: 700;
  color: #374151;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  border: 1px solid #d1d5db;
  border-radius: 12px;
  padding: 12px 14px;
  font: inherit;
  background: #fff;
  color: #111827;
}

.form-message {
  margin: 16px 0 0;
  padding: 12px 14px;
  border-radius: 12px;
  font-weight: 600;
}

.form-error {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
}

.form-success {
  background: #ecfdf5;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}

.student-callout {
  margin-top: 18px;
  border: 1px solid #dbeafe;
  background: #eff6ff;
  border-radius: 16px;
  padding: 16px;
}

.student-callout strong {
  display: block;
  margin-bottom: 6px;
  color: #1d4ed8;
}

.student-callout p {
  margin: 0;
  color: #374151;
}

.instructor-callout {
  border-color: #dcfce7;
  background: #f0fdf4;
}

.instructor-callout strong {
  color: #166534;
}

.session-summary-strip {
  display: flex;
  gap: 12px;
  margin-bottom: 18px;
  flex-wrap: wrap;
}

.summary-mini-card {
  min-width: 130px;
  border-radius: 16px;
  padding: 14px 16px;
  border: 1px solid #e5e7eb;
  background: #f9fafb;
}

.summary-mini-card span {
  display: block;
  font-size: 12px;
  color: #6b7280;
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0.06em;
  margin-bottom: 6px;
}

.summary-mini-card strong {
  font-size: 24px;
}

.live-mini {
  background: #ecfdf5;
  border-color: #bbf7d0;
}

.scheduled-mini {
  background: #eff6ff;
  border-color: #bfdbfe;
}

.session-list {
  display: grid;
  gap: 16px;
}

.session-card {
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 18px;
  background: #fcfdff;
}

.session-top {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 14px;
}

.session-top h3 {
  margin: 0 0 6px;
}

.session-top p {
  margin: 0;
  color: #6b7280;
}

.session-meta {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.session-meta p,
.notes {
  margin: 0;
  color: #374151;
}

.session-hint {
  margin: 12px 0 0;
  color: #6b7280;
  font-size: 14px;
}

.session-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
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

@media (max-width: 800px) {
  .page {
    padding: 20px 14px 32px;
  }

  .hero,
  .class-header,
  .session-top {
    flex-direction: column;
  }

  .form-grid,
  .session-meta {
    grid-template-columns: 1fr;
  }

  .session-actions {
    justify-content: stretch;
  }

  .session-actions .btn,
  .classroom-status-actions .btn,
  .hero-actions .btn {
    width: 100%;
  }
}
</style>