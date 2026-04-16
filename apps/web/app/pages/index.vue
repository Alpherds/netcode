<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { definePageMeta, navigateTo, useFetch } from '#imports'

definePageMeta({
  middleware: 'auth',
})

type ProfileItem = {
  id: number
  display_name?: string | null
  role_label?: string | null
  student_no?: string | null
  employee_no?: string | null
  program?: string | null
  year_level?: string | number | null
  section?: string | null
  is_active?: boolean | null
  avatar?: string | null
}

type Classroom = {
  id: number
  title?: string | null
  code?: string | null
  description?: string | null
  term?: string | null
  class_status?: 'OPEN' | 'CLOSED' | 'ARCHIVED' | string | null
}

type CreateClassroomForm = {
  title: string
  code: string
  description: string
  term: string
  class_status: 'OPEN' | 'CLOSED' | 'ARCHIVED'
}

defineOptions({
  name: 'DashboardPage',
})

const { data: profile } = await useFetch<ProfileItem>('/api/profile')

const {
  data: classrooms,
  pending: classroomsPending,
  error: classroomsError,
  refresh: refreshClassrooms,
} = await useFetch<Classroom[]>('/api/classrooms')

const roleLabel = computed(() =>
  String(profile.value?.role_label || '').toUpperCase()
)

const isInstructor = computed(() => roleLabel.value === 'INSTRUCTOR')
const safeClassrooms = computed(() => classrooms.value ?? [])

const activeClassrooms = computed(() =>
  safeClassrooms.value.filter(
    (item) => String(item.class_status || '').toUpperCase() !== 'ARCHIVED'
  )
)

const archivedClassrooms = computed(() =>
  safeClassrooms.value.filter(
    (item) => String(item.class_status || '').toUpperCase() === 'ARCHIVED'
  )
)

const search = ref('')
const activeTab = ref<'active' | 'archived'>('active')

const filteredActiveClassrooms = computed(() => {
  const keyword = search.value.trim().toLowerCase()

  if (!keyword) return activeClassrooms.value

  return activeClassrooms.value.filter((item) => {
    return (
      String(item.title || '').toLowerCase().includes(keyword) ||
      String(item.code || '').toLowerCase().includes(keyword) ||
      String(item.description || '').toLowerCase().includes(keyword) ||
      String(item.term || '').toLowerCase().includes(keyword)
    )
  })
})

const filteredArchivedClassrooms = computed(() => {
  const keyword = search.value.trim().toLowerCase()

  if (!keyword) return archivedClassrooms.value

  return archivedClassrooms.value.filter((item) => {
    return (
      String(item.title || '').toLowerCase().includes(keyword) ||
      String(item.code || '').toLowerCase().includes(keyword) ||
      String(item.description || '').toLowerCase().includes(keyword) ||
      String(item.term || '').toLowerCase().includes(keyword)
    )
  })
})

const shouldScrollClassrooms = computed(() => {
  const count =
    activeTab.value === 'active'
      ? filteredActiveClassrooms.value.length
      : filteredArchivedClassrooms.value.length

  return count > 4
})

const alertType = ref<'success' | 'error' | 'info' | 'warning'>('success')
const alertMessage = ref('')
const showAlert = ref(false)

const showCreateDialog = ref(false)
const isSubmitting = ref(false)

const createForm = ref<CreateClassroomForm>({
  title: '',
  code: '',
  description: '',
  term: '',
  class_status: 'OPEN',
})

const autoRefreshSeconds = 20
let refreshTimer: ReturnType<typeof setInterval> | null = null
let alertTimer: ReturnType<typeof setTimeout> | null = null

const showAppAlert = (
  type: 'success' | 'error' | 'info' | 'warning',
  message: string
) => {
  alertType.value = type
  alertMessage.value = message
  showAlert.value = true

  if (alertTimer) {
    clearTimeout(alertTimer)
  }

  alertTimer = setTimeout(() => {
    showAlert.value = false
  }, 3000)
}

const resetCreateForm = () => {
  createForm.value = {
    title: '',
    code: '',
    description: '',
    term: '',
    class_status: 'OPEN',
  }
}

const openCreateDialog = () => {
  resetCreateForm()
  showCreateDialog.value = true
}

const closeCreateDialog = () => {
  showCreateDialog.value = false
  resetCreateForm()
}

const createClassroom = async () => {
  const title = createForm.value.title.trim()
  const code = createForm.value.code.trim()
  const description = createForm.value.description.trim()
  const term = createForm.value.term.trim()
  const classStatus = createForm.value.class_status

  if (!title) {
    showAppAlert('error', 'Classroom title is required.')
    return
  }

  if (!code) {
    showAppAlert('error', 'Classroom code is required.')
    return
  }

  if (!term) {
    showAppAlert('error', 'Term is required.')
    return
  }

  isSubmitting.value = true

  try {
    await $fetch('/api/classrooms', {
      method: 'POST',
      body: {
        title,
        code,
        description,
        term,
        class_status: classStatus,
      },
    })

    closeCreateDialog()
    await refreshClassrooms()
    showAppAlert('success', 'Classroom created successfully.')
  } catch (error: any) {
    showAppAlert(
      'error',
      error?.data?.message ||
        error?.statusMessage ||
        'Failed to create classroom.'
    )
  } finally {
    isSubmitting.value = false
  }
}

const updateClassroomStatus = async (
  classroomId: number,
  status: 'OPEN' | 'CLOSED' | 'ARCHIVED'
) => {
  try {
    await $fetch(`/api/classrooms/${classroomId}/status`, {
      method: 'POST',
      body: {
        class_status: status,
      },
    })

    await refreshClassrooms()

    const statusLabel =
      status === 'OPEN'
        ? 'reopened'
        : status === 'CLOSED'
          ? 'closed'
          : 'archived'

    showAppAlert('success', `Classroom ${statusLabel} successfully.`)
  } catch (error: any) {
    showAppAlert(
      'error',
      error?.data?.message ||
        error?.statusMessage ||
        'Failed to update classroom status.'
    )
  }
}

const goToClassroom = async (id: number) => {
  await navigateTo(`/classes/${id}`)
}

const logout = async () => {
  try {
    await $fetch('/api/logout', {
      method: 'POST',
    })
  } catch {
    // ignore logout API errors
  }

  await navigateTo('/login')
}

const startAutoRefresh = () => {
  if (refreshTimer) return

  refreshTimer = setInterval(async () => {
    await refreshClassrooms()
  }, autoRefreshSeconds * 1000)
}

const stopAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

onMounted(() => {
  startAutoRefresh()
})

onBeforeUnmount(() => {
  stopAutoRefresh()

  if (alertTimer) {
    clearTimeout(alertTimer)
    alertTimer = null
  }
})

const classroomStatusColor = (status?: string | null) => {
  const normalized = String(status || '').toUpperCase()

  if (normalized === 'OPEN') return 'success'
  if (normalized === 'CLOSED') return 'warning'
  if (normalized === 'ARCHIVED') return 'grey'
  return 'grey'
}

const classroomStatusLabel = (status?: string | null) => {
  const normalized = String(status || '').toUpperCase()

  if (normalized === 'OPEN') return 'Open'
  if (normalized === 'CLOSED') return 'Closed'
  if (normalized === 'ARCHIVED') return 'Archived'
  return normalized || 'Unknown'
}
</script>

<template>
  <v-container fluid class="dashboard pa-4 pa-md-6">
    <v-alert
      v-if="showAlert"
      v-model="showAlert"
      :type="alertType"
      variant="tonal"
      closable
      class="mb-4"
    >
      {{ alertMessage }}
    </v-alert>

    <v-card class="hero-card mb-6" elevation="4" rounded="xl">
      <v-card-text class="pa-5 pa-md-8">
        <div class="d-flex flex-column flex-md-row align-start align-md-center justify-space-between ga-4">
          <div class="d-flex align-start ga-4 hero-left">
            <div class="logo-shell">
              <v-img
                src="/logo.png"
                alt="NETCODE Logo"
                contain
                class="hero-logo-img"
              />
            </div>

            <div>
              <div class="text-primary font-weight-bold text-caption text-sm-body-2 mb-1">
                Interactive Virtual Laboratory
              </div>

              <div class="text-h4 text-md-h4 font-weight-bold mb-2">
                Dashboard
              </div>

              <div class="text-medium-emphasis mb-3">
                Welcome back, {{ profile?.display_name || 'User' }}.
              </div>

              <div class="d-flex flex-wrap ga-2">
                <v-chip
                  color="primary"
                  variant="tonal"
                  prepend-icon="mdi-account-badge-outline"
                  rounded="pill"
                >
                  {{ roleLabel || 'USER' }}
                </v-chip>
              </div>
            </div>
          </div>

          <div class="d-flex flex-wrap ga-2 hero-actions">
            <v-btn
              v-if="isInstructor"
              color="primary"
              size="large"
              rounded="pill"
              prepend-icon="mdi-plus"
              elevation="2"
              @click="openCreateDialog"
            >
              Create Classroom
            </v-btn>

            <v-btn
              color="grey-darken-4"
              variant="flat"
              size="large"
              rounded="pill"
              prepend-icon="mdi-logout"
              @click="logout"
            >
              Logout
            </v-btn>
          </div>
        </div>
      </v-card-text>
    </v-card>

    <v-row align="stretch" dense>
      <v-col cols="12" lg="8">
        <v-card rounded="xl" elevation="4" class="h-100 section-card">
          <v-card-text class="pa-5">
            <div class="d-flex flex-column flex-md-row justify-space-between align-start ga-3 mb-5">
              <div>
                <div class="text-h5 font-weight-bold">My Classrooms</div>
                <div class="text-medium-emphasis">
                  Browse active classes and archived records.
                </div>
              </div>

              <v-chip
                color="primary"
                variant="tonal"
                rounded="pill"
                class="font-weight-bold"
              >
                {{
                  activeTab === 'active'
                    ? filteredActiveClassrooms.length
                    : filteredArchivedClassrooms.length
                }}
              </v-chip>
            </div>

            <v-text-field
              v-model="search"
              prepend-inner-icon="mdi-magnify"
              label="Search classrooms"
              variant="outlined"
              rounded="xl"
              density="comfortable"
              hide-details
              class="mb-4"
            />

            <v-tabs
              v-model="activeTab"
              color="primary"
              align-tabs="center"
              class="mb-4"
            >
              <v-tab value="active">
                Active Classrooms
                <v-chip size="x-small" class="ml-2" variant="tonal">
                  {{ activeClassrooms.length }}
                </v-chip>
              </v-tab>

              <v-tab value="archived">
                Archived Classrooms
                <v-chip size="x-small" class="ml-2" variant="tonal">
                  {{ archivedClassrooms.length }}
                </v-chip>
              </v-tab>
            </v-tabs>

            <v-window v-model="activeTab">
              <v-window-item value="active">
                <div v-if="classroomsPending" class="py-10 text-center">
                  <v-progress-circular indeterminate color="primary" />
                  <div class="mt-3 text-medium-emphasis">
                    Loading classrooms...
                  </div>
                </div>

                <v-alert
                  v-else-if="classroomsError"
                  type="error"
                  variant="tonal"
                  rounded="xl"
                >
                  Failed to load classrooms.
                </v-alert>

                <div
                  v-else
                  :class="[
                    'classroom-scroll-wrapper',
                    { 'classroom-scroll-area': shouldScrollClassrooms }
                  ]"
                >
                  <v-row dense class="classroom-grid-row">
                    <v-col
                      v-for="item in filteredActiveClassrooms"
                      :key="item.id"
                      cols="12"
                      md="6"
                    >
                      <v-card
                        rounded="xl"
                        elevation="3"
                        class="classroom-card"
                      >
                        <v-card-text class="classroom-card-content">
                          <div class="d-flex align-start justify-space-between ga-3 mb-4">
                            <div class="classroom-main">
                              <div class="text-h6 font-weight-bold classroom-title">
                                {{ item.title || 'Untitled Classroom' }}
                              </div>
                              <div class="text-primary font-weight-medium classroom-code">
                                {{ item.code || '—' }}
                              </div>
                            </div>

                            <v-chip
                              :color="classroomStatusColor(item.class_status)"
                              variant="tonal"
                              rounded="pill"
                              class="status-chip"
                            >
                              {{ classroomStatusLabel(item.class_status) }}
                            </v-chip>
                          </div>

                          <div class="text-body-2 text-medium-emphasis classroom-description mb-4">
                            {{ item.description || 'No description provided.' }}
                          </div>

                          <div class="classroom-meta mb-4">
                            <div class="text-body-2">
                              <strong>Term:</strong> {{ item.term || '—' }}
                            </div>
                            <div class="text-body-2">
                              <strong>ID:</strong> {{ item.id }}
                            </div>
                          </div>

                          <div class="classroom-card-actions">
                            <v-btn
                              color="primary"
                              variant="flat"
                              rounded="pill"
                              prepend-icon="mdi-open-in-new"
                              @click="goToClassroom(item.id)"
                            >
                              View
                            </v-btn>

                            <div
                              v-if="isInstructor"
                              class="d-flex flex-wrap ga-2 action-group"
                            >
                              <v-btn
                                v-if="String(item.class_status || '').toUpperCase() === 'OPEN'"
                                color="warning"
                                variant="flat"
                                rounded="pill"
                                prepend-icon="mdi-lock-outline"
                                @click="updateClassroomStatus(item.id, 'CLOSED')"
                              >
                                Close
                              </v-btn>

                              <v-btn
                                v-else-if="String(item.class_status || '').toUpperCase() === 'CLOSED'"
                                color="success"
                                variant="flat"
                                rounded="pill"
                                prepend-icon="mdi-lock-open-variant-outline"
                                @click="updateClassroomStatus(item.id, 'OPEN')"
                              >
                                Reopen
                              </v-btn>

                              <v-btn
                                color="grey-darken-1"
                                variant="flat"
                                rounded="pill"
                                prepend-icon="mdi-archive-outline"
                                @click="updateClassroomStatus(item.id, 'ARCHIVED')"
                              >
                                Archive
                              </v-btn>
                            </div>
                          </div>
                        </v-card-text>
                      </v-card>
                    </v-col>

                    <v-col
                      v-if="filteredActiveClassrooms.length === 0"
                      cols="12"
                    >
                      <v-sheet
                        rounded="xl"
                        color="surface-variant"
                        class="pa-8 text-center"
                      >
                        <v-icon size="40" color="medium-emphasis">
                          mdi-book-open-page-variant-outline
                        </v-icon>
                        <div class="text-h6 mt-3 mb-2">
                          No active classrooms found
                        </div>
                        <div class="text-medium-emphasis">
                          {{
                            search
                              ? 'Try a different search keyword.'
                              : 'Your active classrooms will appear here.'
                          }}
                        </div>
                      </v-sheet>
                    </v-col>
                  </v-row>
                </div>
              </v-window-item>

              <v-window-item value="archived">
                <div
                  :class="[
                    'classroom-scroll-wrapper',
                    { 'classroom-scroll-area': shouldScrollClassrooms }
                  ]"
                >
                  <v-row dense class="classroom-grid-row">
                    <v-col
                      v-for="item in filteredArchivedClassrooms"
                      :key="item.id"
                      cols="12"
                      md="6"
                    >
                      <v-card
                        rounded="xl"
                        elevation="2"
                        class="classroom-card archived-card"
                      >
                        <v-card-text class="classroom-card-content">
                          <div class="d-flex align-start justify-space-between ga-3 mb-4">
                            <div class="classroom-main">
                              <div class="text-h6 font-weight-bold classroom-title">
                                {{ item.title || 'Untitled Classroom' }}
                              </div>
                              <div class="text-primary font-weight-medium classroom-code">
                                {{ item.code || '—' }}
                              </div>
                            </div>

                            <v-chip
                              color="grey"
                              variant="tonal"
                              rounded="pill"
                              class="status-chip"
                            >
                              Archived
                            </v-chip>
                          </div>

                          <div class="text-body-2 text-medium-emphasis classroom-description mb-4">
                            {{ item.description || 'No description provided.' }}
                          </div>

                          <div class="classroom-meta mb-4">
                            <div class="text-body-2">
                              <strong>Term:</strong> {{ item.term || '—' }}
                            </div>
                            <div class="text-body-2">
                              <strong>ID:</strong> {{ item.id }}
                            </div>
                          </div>

                          <div class="classroom-card-actions">
                            <v-btn
                              color="primary"
                              variant="tonal"
                              rounded="pill"
                              prepend-icon="mdi-open-in-new"
                              @click="goToClassroom(item.id)"
                            >
                              View
                            </v-btn>

                            <div v-if="isInstructor" class="d-flex ga-2 action-group">
                              <v-btn
                                color="success"
                                variant="flat"
                                rounded="pill"
                                prepend-icon="mdi-restore"
                                @click="updateClassroomStatus(item.id, 'CLOSED')"
                              >
                                Restore
                              </v-btn>
                            </div>
                          </div>
                        </v-card-text>
                      </v-card>
                    </v-col>

                    <v-col
                      v-if="filteredArchivedClassrooms.length === 0"
                      cols="12"
                    >
                      <v-sheet
                        rounded="xl"
                        color="surface-variant"
                        class="pa-8 text-center"
                      >
                        <v-icon size="40" color="medium-emphasis">
                          mdi-archive-outline
                        </v-icon>
                        <div class="text-h6 mt-3 mb-2">
                          No archived classrooms
                        </div>
                        <div class="text-medium-emphasis">
                          Archived classrooms will appear here.
                        </div>
                      </v-sheet>
                    </v-col>
                  </v-row>
                </div>
              </v-window-item>
            </v-window>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" lg="4">
        <v-card rounded="xl" elevation="4" class="h-100 section-card">
          <v-card-text class="pa-5">
            <div class="text-h5 font-weight-bold mb-1">Learning Tools</div>
            <div class="text-medium-emphasis mb-4">
              UI placeholders for the next modules.
            </div>

            <div class="d-flex flex-column ga-4">
              <v-card
                rounded="xl"
                variant="tonal"
                color="cyan-darken-2"
                class="tool-card"
              >
                <v-card-text class="pa-5 d-flex flex-column justify-space-between h-100">
                  <div class="d-flex align-start justify-space-between ga-3">
                    <div class="d-flex ga-3">
                      <v-avatar color="cyan-darken-2" size="48">
                        <v-icon>mdi-code-tags</v-icon>
                      </v-avatar>

                      <div>
                        <div class="text-h6 font-weight-bold">Code Lab</div>
                        <div class="text-medium-emphasis">Coming soon</div>
                      </div>
                    </div>

                    <v-chip size="small" variant="outlined">UI Only</v-chip>
                  </div>

                  <div class="text-medium-emphasis mt-6">
                    Interactive coding workspace for lab exercises,
                    submissions, and feedback.
                  </div>
                </v-card-text>
              </v-card>

              <v-card
                rounded="xl"
                variant="tonal"
                color="indigo-darken-1"
                class="tool-card"
              >
                <v-card-text class="pa-5 d-flex flex-column justify-space-between h-100">
                  <div class="d-flex align-start justify-space-between ga-3">
                    <div class="d-flex ga-3">
                      <v-avatar color="indigo-darken-1" size="48">
                        <v-icon>mdi-monitor-dashboard</v-icon>
                      </v-avatar>

                      <div>
                        <div class="text-h6 font-weight-bold">Simulator</div>
                        <div class="text-medium-emphasis">Coming soon</div>
                      </div>
                    </div>

                    <v-chip size="small" variant="outlined">UI Only</v-chip>
                  </div>

                  <div class="text-medium-emphasis mt-6">
                    Virtual simulation area for guided activities and
                    interactive demonstrations.
                  </div>
                </v-card-text>
              </v-card>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-dialog v-model="showCreateDialog" max-width="720">
      <v-card rounded="xl">
        <v-card-title class="text-h5 font-weight-bold pt-5 px-5">
          Create Classroom
        </v-card-title>

        <v-card-text class="px-5 pt-3">
          <v-row dense>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="createForm.title"
                label="Title"
                variant="outlined"
                rounded="xl"
              />
            </v-col>

            <v-col cols="12" md="6">
              <v-text-field
                v-model="createForm.code"
                label="Code"
                variant="outlined"
                rounded="xl"
              />
            </v-col>

            <v-col cols="12">
              <v-textarea
                v-model="createForm.description"
                label="Description"
                variant="outlined"
                rounded="xl"
                rows="4"
                auto-grow
              />
            </v-col>

            <v-col cols="12" md="6">
              <v-text-field
                v-model="createForm.term"
                label="Term"
                variant="outlined"
                rounded="xl"
              />
            </v-col>

            <v-col cols="12" md="6">
              <v-select
                v-model="createForm.class_status"
                label="Status"
                variant="outlined"
                rounded="xl"
                :items="['OPEN', 'CLOSED']"
              />
            </v-col>
          </v-row>
        </v-card-text>

        <v-card-actions class="px-5 pb-5">
          <v-spacer />
          <v-btn
            variant="text"
            rounded="pill"
            :disabled="isSubmitting"
            @click="closeCreateDialog"
          >
            Cancel
          </v-btn>

          <v-btn
            color="primary"
            rounded="pill"
            :loading="isSubmitting"
            @click="createClassroom"
          >
            Save Classroom
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
.dashboard {
  min-height: 100vh;
  background:
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.06), transparent 30%),
    radial-gradient(circle at bottom left, rgba(99, 102, 241, 0.05), transparent 30%),
    #f5f7fb;
}

.hero-card {
  overflow: hidden;
  border: 1px solid rgba(37, 99, 235, 0.08);
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(239, 246, 255, 0.95));
}

.hero-left {
  min-width: 0;
}

.logo-shell {
  width: 300px;
  height: 120px;
  flex-shrink: 0;
  border-radius: 22px;
  background: #ffffff;
  box-shadow: 0 10px 25px rgba(15, 23, 42, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
}

.hero-logo-img {
  width: 100%;
  height: 100%;
}

.hero-actions {
  flex-shrink: 0;
}

.section-card {
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: rgba(255, 255, 255, 0.96);
}

.classroom-scroll-wrapper {
  overflow: visible;
}

.classroom-scroll-area {
  max-height: 430px;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 10px 10px 2px 2px;
}

.classroom-scroll-area::-webkit-scrollbar {
  width: 8px;
}

.classroom-scroll-area::-webkit-scrollbar-thumb {
  background: rgba(100, 116, 139, 0.35);
  border-radius: 999px;
}

.classroom-scroll-area::-webkit-scrollbar-track {
  background: transparent;
}

.classroom-grid-row {
  margin: 0 !important;
  padding: 2px 4px 10px 2px;
}

.classroom-card {
  height: 100%;
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: linear-gradient(180deg, #ffffff 0%, #fbfcff 100%);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease;
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.08);
}

.classroom-card:hover {
  transform: translateY(-2px);
  border-color: rgba(37, 99, 235, 0.16);
  box-shadow: 0 16px 30px rgba(15, 23, 42, 0.12);
}

.classroom-card-content {
  min-height: 260px;
  display: flex;
  flex-direction: column;
  padding: 18px !important;
}

.classroom-main {
  min-width: 0;
}

.classroom-title {
  line-height: 1.2;
  word-break: break-word;
}

.classroom-code {
  margin-top: 4px;
}

.classroom-description {
  min-height: 44px;
  line-height: 1.55;
}

.classroom-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.classroom-card-actions {
  margin-top: auto;
  padding-top: 12px;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

.action-group {
  justify-content: flex-end;
}

.status-chip {
  flex-shrink: 0;
}

.archived-card {
  opacity: 0.96;
}

.tool-card {
  min-height: 180px;
  border: 1px solid rgba(15, 23, 42, 0.05);
}

@media (max-width: 1264px) {
  .classroom-scroll-area {
    max-height: none;
    overflow: visible;
    padding: 0;
  }

  .classroom-grid-row {
    padding: 0;
  }
}

@media (max-width: 960px) {
  .tool-card {
    min-height: auto;
  }

  .classroom-card-content {
    min-height: unset;
  }

  .classroom-card-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .classroom-card-actions :deep(.v-btn) {
    width: 100%;
  }

  .action-group {
    width: 100%;
    justify-content: stretch;
  }

  .action-group :deep(.v-btn) {
    flex: 1 1 100%;
  }

  .hero-actions {
    width: 100%;
  }

  .hero-actions :deep(.v-btn) {
    flex: 1 1 100%;
  }
}
</style>