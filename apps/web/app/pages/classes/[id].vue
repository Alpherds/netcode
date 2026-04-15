<script setup lang="ts">
import { computed } from 'vue'
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

      <button class="btn" @click="refreshAll">Refresh</button>
    </header>

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

  .session-meta {
    grid-template-columns: 1fr;
  }
}
</style>