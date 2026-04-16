<script setup lang="ts">
import { computed, ref } from 'vue'
import { definePageMeta, navigateTo, useFetch } from '#imports'
import { useAuth } from '~/composables/useAuth'

definePageMeta({
  middleware: 'auth',
})

type Profile = {
  id: number
  display_name?: string | null
  role_label?: 'STUDENT' | 'INSTRUCTOR' | 'ADMIN' | string | null
  student_no?: string | null
  employee_no?: string | null
  program?: string | null
  year_level?: number | null
  section?: string | null
  is_active?: boolean | null
  auth_user_id?: number | null
}

type Classroom = {
  id: number
  title?: string | null
  code?: string | null
  description?: string | null
  term?: string | null
  class_status?: 'OPEN' | 'CLOSED' | 'ARCHIVED' | string | null
}

type ClassroomForm = {
  title: string
  code: string
  description: string
  term: string
  class_status: 'OPEN' | 'CLOSED' | 'ARCHIVED'
}

const { user, logout } = useAuth()

const {
  data: profile,
  pending: profilePending,
  error: profileError,
  refresh: refreshProfile,
} = await useFetch<Profile | null>('/api/profile')

const {
  data: classrooms,
  pending: classroomsPending,
  error: classroomsError,
  refresh: refreshClassrooms,
} = await useFetch<Classroom[]>('/api/classrooms')

const safeProfile = computed(() => profile.value ?? null)
const safeClassrooms = computed(() => classrooms.value ?? [])

const displayName = computed(() => {
  if (safeProfile.value?.display_name) return safeProfile.value.display_name
  if (user.value?.username) return user.value.username
  return 'User'
})

const roleLabel = computed(() => safeProfile.value?.role_label || 'Authenticated User')

const canCreateClassroom = computed(() => {
  const role = String(safeProfile.value?.role_label || '').toUpperCase()
  return role === 'INSTRUCTOR' || role === 'ADMIN'
})

const idLabel = computed(() => {
  if (safeProfile.value?.employee_no) return `Employee No: ${safeProfile.value.employee_no}`
  if (safeProfile.value?.student_no) return `Student No: ${safeProfile.value.student_no}`
  return 'No ID assigned'
})

const activeClassesCount = computed(() =>
  safeClassrooms.value.filter((c) => c.class_status === 'OPEN').length
)

const archivedClassesCount = computed(() =>
  safeClassrooms.value.filter((c) => c.class_status === 'ARCHIVED').length
)

const showCreateClassroom = ref(false)
const isCreatingClassroom = ref(false)
const classroomFormError = ref('')
const classroomFormSuccess = ref('')

const updatingClassroomId = ref<number | null>(null)
const classroomStatusError = ref('')
const classroomStatusSuccess = ref('')

const classroomForm = ref<ClassroomForm>({
  title: '',
  code: '',
  description: '',
  term: '',
  class_status: 'OPEN',
})

const resetClassroomForm = () => {
  classroomForm.value = {
    title: '',
    code: '',
    description: '',
    term: '',
    class_status: 'OPEN',
  }
  classroomFormError.value = ''
  classroomFormSuccess.value = ''
}

const toggleCreateClassroom = () => {
  if (!canCreateClassroom.value) return

  showCreateClassroom.value = !showCreateClassroom.value

  if (!showCreateClassroom.value) {
    resetClassroomForm()
  }
}

const submitCreateClassroom = async () => {
  classroomFormError.value = ''
  classroomFormSuccess.value = ''

  if (!classroomForm.value.title.trim()) {
    classroomFormError.value = 'Classroom title is required.'
    return
  }

  if (!classroomForm.value.code.trim()) {
    classroomFormError.value = 'Classroom code is required.'
    return
  }

  if (!classroomForm.value.term.trim()) {
    classroomFormError.value = 'Term is required.'
    return
  }

  isCreatingClassroom.value = true

  try {
    const createClassroomUrl: string = '/api/classrooms'

    await $fetch(createClassroomUrl, {
      method: 'POST',
      body: {
        title: classroomForm.value.title,
        code: classroomForm.value.code,
        description: classroomForm.value.description,
        term: classroomForm.value.term,
        class_status: classroomForm.value.class_status,
      },
    })

    classroomFormSuccess.value = 'Classroom created successfully.'
    await refreshClassrooms()
    resetClassroomForm()
    showCreateClassroom.value = false
  } catch (error: any) {
    classroomFormError.value =
      error?.data?.message ||
      error?.statusMessage ||
      'Failed to create classroom.'
  } finally {
    isCreatingClassroom.value = false
  }
}

const updateClassroomStatus = async (
  classroomId: number,
  nextStatus: 'OPEN' | 'CLOSED' | 'ARCHIVED'
) => {
  classroomStatusError.value = ''
  classroomStatusSuccess.value = ''
  updatingClassroomId.value = classroomId

  try {
    const updateStatusUrl: string = `/api/classrooms/${classroomId}/status`

    await $fetch(updateStatusUrl, {
      method: 'POST',
      body: {
        class_status: nextStatus,
      },
    })

    classroomStatusSuccess.value = `Classroom marked as ${nextStatus}.`
    await refreshClassrooms()
  } catch (error: any) {
    classroomStatusError.value =
      error?.data?.message ||
      error?.statusMessage ||
      'Failed to update classroom status.'
  } finally {
    updatingClassroomId.value = null
  }
}

const canOpenClassroom = (status?: string | null) => status !== 'OPEN'
const canCloseClassroom = (status?: string | null) => status === 'OPEN'
const canArchiveClassroom = (status?: string | null) => status !== 'ARCHIVED'

const doLogout = async () => {
  await logout()
  await navigateTo('/login')
}

const refreshAll = async () => {
  await Promise.all([refreshProfile(), refreshClassrooms()])
}

const badgeClass = (status?: string | null) => {
  switch (status) {
    case 'OPEN':
      return 'badge badge-open'
    case 'CLOSED':
      return 'badge badge-closed'
    case 'ARCHIVED':
      return 'badge badge-archived'
    default:
      return 'badge'
  }
}

const openClassroom = async (id: number) => {
  await navigateTo(`/classes/${id}`)
}
</script>

<template>
  <div class="dashboard-page">
    <header class="hero">
      <div>
        <p class="eyebrow">Netcode</p>
        <h1>Dashboard</h1>
        <p class="subtitle">
          Welcome back, {{ displayName }}.
        </p>
      </div>

      <div class="hero-actions">
        <button class="btn btn-secondary" @click="refreshAll">
          Refresh
        </button>
        <button class="btn btn-danger" @click="doLogout">
          Logout
        </button>
      </div>
    </header>

    <section class="stats-grid">
      <article class="stat-card">
        <span class="stat-label">Logged In As</span>
        <strong class="stat-value">{{ user?.email || '—' }}</strong>
      </article>

      <article class="stat-card">
        <span class="stat-label">Role</span>
        <strong class="stat-value">{{ roleLabel }}</strong>
      </article>

      <article class="stat-card">
        <span class="stat-label">Open Classes</span>
        <strong class="stat-value">{{ activeClassesCount }}</strong>
      </article>

      <article class="stat-card">
        <span class="stat-label">Archived Classes</span>
        <strong class="stat-value">{{ archivedClassesCount }}</strong>
      </article>
    </section>

    <section class="content-grid">
      <article class="panel profile-panel">
        <div class="panel-header">
          <h2>Profile Summary</h2>
          <span
            class="status-pill"
            :class="safeProfile?.is_active ? 'status-active' : 'status-inactive'"
          >
            {{ safeProfile?.is_active ? 'Active' : 'Inactive' }}
          </span>
        </div>

        <div v-if="profilePending" class="empty-state">
          Loading profile...
        </div>

        <div v-else-if="profileError" class="empty-state error-state">
          Failed to load profile.
        </div>

        <div v-else-if="safeProfile" class="profile-details">
          <div class="profile-main">
            <div class="avatar-fallback">
              {{ displayName.charAt(0).toUpperCase() }}
            </div>

            <div>
              <h3>{{ safeProfile.display_name || 'No display name' }}</h3>
              <p>{{ roleLabel }}</p>
              <p>{{ idLabel }}</p>
            </div>
          </div>

          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Program</span>
              <strong>{{ safeProfile.program || '—' }}</strong>
            </div>

            <div class="info-item">
              <span class="info-label">Year Level</span>
              <strong>{{ safeProfile.year_level ?? '—' }}</strong>
            </div>

            <div class="info-item">
              <span class="info-label">Section</span>
              <strong>{{ safeProfile.section || '—' }}</strong>
            </div>

            <div class="info-item">
              <span class="info-label">Auth User ID</span>
              <strong>{{ safeProfile.auth_user_id ?? '—' }}</strong>
            </div>
          </div>
        </div>

        <div v-else class="empty-state">
          No profile found.
        </div>
      </article>

      <article class="panel classes-panel">
        <div class="panel-header">
          <h2>My Classrooms</h2>

          <div class="classes-header-actions">
            <span class="panel-count">{{ safeClassrooms.length }}</span>

            <button
              v-if="canCreateClassroom"
              class="btn btn-primary"
              @click="toggleCreateClassroom"
            >
              {{ showCreateClassroom ? 'Close Form' : 'Create Classroom' }}
            </button>
          </div>
        </div>

        <section
          v-if="showCreateClassroom && canCreateClassroom"
          class="create-classroom-box"
        >
          <h3>Create Classroom</h3>

          <div class="form-grid">
            <div class="form-group">
              <label>Title</label>
              <input
                v-model="classroomForm.title"
                type="text"
                placeholder="Enter classroom title"
              />
            </div>

            <div class="form-group">
              <label>Code</label>
              <input
                v-model="classroomForm.code"
                type="text"
                placeholder="Enter classroom code"
              />
            </div>

            <div class="form-group full">
              <label>Description</label>
              <textarea
                v-model="classroomForm.description"
                rows="4"
                placeholder="Enter classroom description"
              />
            </div>

            <div class="form-group">
              <label>Term</label>
              <input
                v-model="classroomForm.term"
                type="text"
                placeholder="e.g. 1st Semester AY 2026-2027"
              />
            </div>

            <div class="form-group">
              <label>Status</label>
              <select v-model="classroomForm.class_status">
                <option value="OPEN">OPEN</option>
                <option value="CLOSED">CLOSED</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
            </div>
          </div>

          <p v-if="classroomFormError" class="form-message form-error">
            {{ classroomFormError }}
          </p>

          <p v-if="classroomFormSuccess" class="form-message form-success">
            {{ classroomFormSuccess }}
          </p>

          <div class="form-actions">
            <button
              class="btn btn-light"
              :disabled="isCreatingClassroom"
              @click="resetClassroomForm"
            >
              Reset
            </button>

            <button
              class="btn btn-primary"
              :disabled="isCreatingClassroom"
              @click="submitCreateClassroom"
            >
              {{ isCreatingClassroom ? 'Creating...' : 'Save Classroom' }}
            </button>
          </div>
        </section>

        <p v-if="classroomStatusError" class="form-message form-error">
          {{ classroomStatusError }}
        </p>

        <p v-if="classroomStatusSuccess" class="form-message form-success">
          {{ classroomStatusSuccess }}
        </p>

        <div v-if="classroomsPending" class="empty-state">
          Loading classrooms...
        </div>

        <div v-else-if="classroomsError" class="empty-state error-state">
          Failed to load classrooms.
        </div>

        <div v-else-if="safeClassrooms.length === 0" class="empty-state">
          No classrooms available yet.
        </div>

        <div v-else class="classroom-grid">
          <article
            v-for="classroom in safeClassrooms"
            :key="classroom.id"
            class="classroom-card clickable"
            @click="openClassroom(classroom.id)"
          >
            <div class="classroom-top">
              <div>
                <h3>{{ classroom.title || 'Untitled Classroom' }}</h3>
                <p class="class-code">{{ classroom.code || 'No code' }}</p>
              </div>

              <span :class="badgeClass(classroom.class_status)">
                {{ classroom.class_status || 'UNKNOWN' }}
              </span>
            </div>

            <p class="class-description">
              {{ classroom.description || 'No description provided.' }}
            </p>

            <div class="class-meta">
              <span><strong>Term:</strong> {{ classroom.term || '—' }}</span>
              <span><strong>ID:</strong> {{ classroom.id }}</span>
            </div>

            <div
              v-if="canCreateClassroom"
              class="classroom-actions"
              @click.stop
            >
              <button
                v-if="canOpenClassroom(classroom.class_status)"
                class="btn btn-open"
                :disabled="updatingClassroomId === classroom.id"
                @click="updateClassroomStatus(classroom.id, 'OPEN')"
              >
                {{ updatingClassroomId === classroom.id ? 'Updating...' : 'Open' }}
              </button>

              <button
                v-if="canCloseClassroom(classroom.class_status)"
                class="btn btn-close"
                :disabled="updatingClassroomId === classroom.id"
                @click="updateClassroomStatus(classroom.id, 'CLOSED')"
              >
                {{ updatingClassroomId === classroom.id ? 'Updating...' : 'Close' }}
              </button>

              <button
                v-if="canArchiveClassroom(classroom.class_status)"
                class="btn btn-archive"
                :disabled="updatingClassroomId === classroom.id"
                @click="updateClassroomStatus(classroom.id, 'ARCHIVED')"
              >
                {{ updatingClassroomId === classroom.id ? 'Updating...' : 'Archive' }}
              </button>
            </div>
          </article>
        </div>
      </article>
    </section>
  </div>
</template>

<style scoped>
.dashboard-page {
  min-height: 100vh;
  padding: 32px 24px 48px;
  background: #f6f8fb;
  color: #1f2937;
}

.hero {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: flex-start;
  margin-bottom: 24px;
  padding: 28px;
  border-radius: 20px;
  background: linear-gradient(135deg, #ffffff, #eef4ff);
  border: 1px solid #e5e7eb;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
}

.eyebrow {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #6366f1;
}

.hero h1 {
  margin: 0;
  font-size: 36px;
  line-height: 1.1;
}

.subtitle {
  margin: 8px 0 0;
  color: #4b5563;
  font-size: 16px;
}

.hero-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.clickable {
  cursor: pointer;
}

.btn {
  border: 0;
  border-radius: 12px;
  padding: 10px 16px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.btn:hover {
  transform: translateY(-1px);
}

.btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
  transform: none;
}

.btn-primary {
  background: #4f46e5;
  color: #ffffff;
}

.btn-secondary {
  background: #111827;
  color: #ffffff;
}

.btn-danger {
  background: #dc2626;
  color: #ffffff;
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

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  padding: 20px;
  border-radius: 18px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
}

.stat-label {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 10px;
}

.stat-value {
  display: block;
  font-size: 18px;
  line-height: 1.35;
  word-break: break-word;
}

.content-grid {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 20px;
}

.panel {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  padding: 22px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.04);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-bottom: 18px;
}

.panel-header h2 {
  margin: 0;
  font-size: 22px;
}

.classes-header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.panel-count {
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

.create-classroom-box {
  border: 1px solid #e5e7eb;
  background: #fafcff;
  border-radius: 18px;
  padding: 18px;
  margin-bottom: 18px;
}

.create-classroom-box h3 {
  margin: 0 0 16px;
  font-size: 20px;
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

.status-pill {
  padding: 8px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.status-active {
  background: #dcfce7;
  color: #166534;
}

.status-inactive {
  background: #fee2e2;
  color: #991b1b;
}

.profile-main {
  display: flex;
  gap: 14px;
  align-items: center;
  margin-bottom: 22px;
}

.profile-main h3 {
  margin: 0 0 6px;
  font-size: 22px;
}

.profile-main p {
  margin: 2px 0;
  color: #4b5563;
}

.avatar-fallback {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: #4f46e5;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 700;
  flex-shrink: 0;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.info-item {
  border: 1px solid #eef2f7;
  background: #f9fbff;
  border-radius: 14px;
  padding: 14px;
}

.info-label {
  display: block;
  margin-bottom: 8px;
  font-size: 12px;
  color: #6b7280;
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0.06em;
}

.classroom-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.classroom-card {
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  padding: 18px;
  background: #fcfdff;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.classroom-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
}

.classroom-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 12px;
}

.classroom-top h3 {
  margin: 0;
  font-size: 20px;
}

.class-code {
  margin: 6px 0 0;
  color: #6366f1;
  font-weight: 700;
  font-size: 14px;
}

.class-description {
  margin: 0 0 14px;
  color: #4b5563;
  line-height: 1.55;
  min-height: 48px;
}

.class-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: #374151;
  font-size: 14px;
}

.classroom-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 14px;
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 7px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  background: #e5e7eb;
  color: #374151;
}

.badge-open {
  background: #dcfce7;
  color: #166534;
}

.badge-closed {
  background: #fef3c7;
  color: #92400e;
}

.badge-archived {
  background: #e5e7eb;
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

.error-state {
  color: #b91c1c;
  border-color: #fecaca;
  background: #fef2f2;
}

@media (max-width: 1100px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .content-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 700px) {
  .dashboard-page {
    padding: 20px 14px 32px;
  }

  .hero {
    flex-direction: column;
    padding: 20px;
  }

  .hero h1 {
    font-size: 30px;
  }

  .stats-grid,
  .info-grid,
  .classroom-grid,
  .form-grid {
    grid-template-columns: 1fr;
  }

  .classroom-top,
  .panel-header,
  .classes-header-actions {
    flex-direction: column;
    align-items: flex-start;
  }

  .form-actions .btn,
  .classes-header-actions .btn,
  .classroom-actions .btn {
    width: 100%;
  }
}
</style>