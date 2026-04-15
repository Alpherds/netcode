<script setup lang="ts">
import { computed, ref } from 'vue'
import { definePageMeta, navigateTo, useFetch, useRoute } from '#imports'

definePageMeta({
  middleware: 'auth',
})

type Classroom = {
  id: number
  title?: string | null
  code?: string | null
  description?: string | null
  term?: string | null
  class_status?: string | null
}

type SessionItem = {
  id: number
  title?: string | null
  starts_at?: string | null
  ends_at?: string | null
  room_name?: string | null
  meeting_provider?: string | null
  meeting_status?: string | null
  notes?: string | null
}

type CreateSessionForm = {
  title: string
  starts_at: string
  ends_at: string
  room_name: string
  meeting_provider: 'JITSI'
  meeting_status: 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED'
  notes: string
}

const route = useRoute()
const classroomId = route.params.id as string

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

const safeSessions = computed(() => sessions.value ?? [])

const showCreateForm = ref(false)
const isSubmitting = ref(false)
const formError = ref('')
const formSuccess = ref('')

const form = ref<CreateSessionForm>({
  title: '',
  starts_at: '',
  ends_at: '',
  room_name: '',
  meeting_provider: 'JITSI',
  meeting_status: 'SCHEDULED',
  notes: '',
})

const resetForm = () => {
  form.value = {
    title: '',
    starts_at: '',
    ends_at: '',
    room_name: '',
    meeting_provider: 'JITSI',
    meeting_status: 'SCHEDULED',
    notes: '',
  }

  formError.value = ''
  formSuccess.value = ''
}

const toggleCreateForm = () => {
  showCreateForm.value = !showCreateForm.value

  if (!showCreateForm.value) {
    resetForm()
  }
}

const submitSession = async () => {
  formError.value = ''
  formSuccess.value = ''

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
    method: 'POST' as 'POST',
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
        <button class="btn btn-secondary" @click="toggleCreateForm">
          {{ showCreateForm ? 'Close Form' : 'Create Session' }}
        </button>
        <button class="btn" @click="refreshAll">Refresh</button>
      </div>
    </header>

    <section v-if="showCreateForm" class="panel">
      <div class="panel-header">
        <h2>Create Session</h2>
      </div>

      <div class="form-grid">
        <div class="form-group full">
          <label>Session Title</label>
          <input v-model="form.title" type="text" placeholder="Enter session title" />
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
          <input v-model="form.room_name" type="text" placeholder="Optional room name" />
        </div>

        <div class="form-group">
          <label>Meeting Provider</label>
          <select v-model="form.meeting_provider">
            <option value="JITSI">JITSI</option>
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
        <button class="btn btn-light" @click="resetForm" :disabled="isSubmitting">
          Reset
        </button>
        <button class="btn btn-primary" @click="submitSession" :disabled="isSubmitting">
          {{ isSubmitting ? 'Creating...' : 'Save Session' }}
        </button>
      </div>
    </section>

    <section v-if="classroomPending" class="panel">Loading classroom...</section>
    <section v-else-if="classroomError" class="panel error">Failed to load classroom.</section>
    <section v-else class="panel">
      <div class="class-header">
        <div>
          <h2>{{ classroom?.title }}</h2>
          <p>{{ classroom?.description || 'No description provided.' }}</p>
        </div>
        <span class="status-pill">{{ classroom?.class_status || 'UNKNOWN' }}</span>
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <h2>Sessions</h2>
        <span class="count">{{ safeSessions.length }}</span>
      </div>

      <div v-if="sessionsPending" class="empty-state">Loading sessions...</div>
      <div v-else-if="sessionsError" class="empty-state error">Failed to load sessions.</div>
      <div v-else-if="safeSessions.length === 0" class="empty-state">No sessions yet.</div>

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
              {{ session.meeting_status || 'UNKNOWN' }}
            </span>
          </div>

          <div class="session-meta">
            <p><strong>Start:</strong> {{ formatDateTime(session.starts_at) }}</p>
            <p><strong>End:</strong> {{ formatDateTime(session.ends_at) }}</p>
            <p><strong>Provider:</strong> {{ session.meeting_provider || '—' }}</p>
          </div>

          <p class="notes">{{ session.notes || 'No notes provided.' }}</p>
        </article>
      </div>
    </section>
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
}
</style>