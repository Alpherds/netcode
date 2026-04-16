<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

type StudentProfile = {
  id: number
  display_name?: string | null
  student_no?: string | null
  program?: string | null
  year_level?: string | null
  section?: string | null
}

type EnrollmentRow = {
  id: number
  documentId?: string
  enrollment_status?: string | null
  student?: StudentProfile | null
}

const props = defineProps<{
  classroomId: string | number
  canManage: boolean
}>()

const enrolled = ref<EnrollmentRow[]>([])
const enrolledLoading = ref(false)
const enrolledError = ref('')

const showAddStudent = ref(false)
const search = ref('')
const searchResults = ref<StudentProfile[]>([])
const searchLoading = ref(false)
const searchError = ref('')
const searchTouched = ref(false)

const addingStudentId = ref<number | null>(null)
const removingEnrollmentId = ref<number | null>(null)

const feedbackType = ref<'success' | 'error' | 'info' | 'warning'>('success')
const feedbackMessage = ref('')
const showFeedback = ref(false)

let feedbackTimer: ReturnType<typeof setTimeout> | null = null

const filteredEnrolled = computed(() => enrolled.value ?? [])

const showToast = (
  type: 'success' | 'error' | 'info' | 'warning',
  message: string
) => {
  feedbackType.value = type
  feedbackMessage.value = message
  showFeedback.value = true

  if (feedbackTimer) {
    clearTimeout(feedbackTimer)
  }

  feedbackTimer = setTimeout(() => {
    showFeedback.value = false
  }, 3000)
}

const studentInitial = (name?: string | null) =>
  String(name || 'S').trim().charAt(0).toUpperCase()

const studentMeta = (student?: StudentProfile | null) => {
  return [
    student?.student_no || 'No student number',
    student?.program || '',
    student?.year_level || '',
    student?.section || '',
  ]
    .filter(Boolean)
    .join(' · ')
}

const resetSearchState = () => {
  search.value = ''
  searchResults.value = []
  searchError.value = ''
  searchTouched.value = false
}

const loadEnrollments = async () => {
  enrolledLoading.value = true
  enrolledError.value = ''

  try {
    enrolled.value = await $fetch<EnrollmentRow[]>(
      `/api/classrooms/${props.classroomId}/enrollments`
    )
  } catch (error: any) {
    enrolledError.value =
      error?.data?.message ||
      error?.statusMessage ||
      'Failed to load enrollments.'
  } finally {
    enrolledLoading.value = false
  }
}

const runSearch = async () => {
  searchError.value = ''
  searchTouched.value = true
  searchLoading.value = true

  try {
    searchResults.value = await $fetch<StudentProfile[]>(
      `/api/students/search?q=${encodeURIComponent(search.value)}&classroomId=${props.classroomId}`
    )
  } catch (error: any) {
    searchError.value =
      error?.data?.message ||
      error?.statusMessage ||
      'Failed to search students.'
  } finally {
    searchLoading.value = false
  }
}

const toggleAddStudent = async () => {
  showAddStudent.value = !showAddStudent.value

  if (showAddStudent.value) {
    await runSearch()
  } else {
    resetSearchState()
  }
}

const addStudent = async (studentId: number) => {
  addingStudentId.value = studentId
  searchError.value = ''

  try {
    await $fetch(`/api/classrooms/${props.classroomId}/enrollments`, {
      method: 'POST',
      body: { studentId },
    })

    await loadEnrollments()
    await runSearch()
    showToast('success', 'Student enrolled successfully.')
  } catch (error: any) {
    searchError.value =
      error?.data?.message ||
      error?.statusMessage ||
      'Failed to enroll student.'

    showToast('error', searchError.value)
  } finally {
    addingStudentId.value = null
  }
}

const dropEnrollment = async (enrollmentId: number) => {
  removingEnrollmentId.value = enrollmentId
  enrolledError.value = ''

  try {
    await $fetch(`/api/enrollments/${enrollmentId}/drop`, {
      method: 'POST',
    })

    await loadEnrollments()

    if (showAddStudent.value) {
      await runSearch()
    }

    showToast('success', 'Student dropped successfully.')
  } catch (error: any) {
    enrolledError.value =
      error?.data?.message ||
      error?.statusMessage ||
      'Failed to drop student.'

    showToast('error', enrolledError.value)
  } finally {
    removingEnrollmentId.value = null
  }
}

watch(search, async (value) => {
  if (!showAddStudent.value) return

  if (!value.trim()) {
    await runSearch()
  }
})

onMounted(async () => {
  await loadEnrollments()
})

onBeforeUnmount(() => {
  if (feedbackTimer) {
    clearTimeout(feedbackTimer)
    feedbackTimer = null
  }
})
</script>

<template>
  <div class="enrollment-manager">
    <v-alert
      v-if="showFeedback"
      v-model="showFeedback"
      :type="feedbackType"
      variant="tonal"
      closable
      class="mb-4"
    >
      {{ feedbackMessage }}
    </v-alert>

    <div class="d-flex flex-column flex-md-row justify-space-between align-start ga-3 mb-5">
      <div>
        <div class="text-h5 font-weight-bold">Enrollments</div>
        <div class="text-body-2 text-medium-emphasis">
          Manage which students can access this classroom and its live sessions.
        </div>
      </div>

      <div class="d-flex align-center flex-wrap ga-2 w-100 w-md-auto justify-end">
        <v-chip color="primary" variant="tonal" rounded="pill">
          {{ filteredEnrolled.length }}
        </v-chip>

        <v-btn
          v-if="canManage"
          color="primary"
          rounded="pill"
          prepend-icon="mdi-account-plus-outline"
          @click="toggleAddStudent"
        >
          {{ showAddStudent ? 'Close Add Student' : 'Add Student' }}
        </v-btn>
      </div>
    </div>

    <v-expand-transition>
      <v-card
        v-if="canManage && showAddStudent"
        rounded="xl"
        elevation="1"
        class="search-panel mb-5"
      >
        <v-card-text class="pa-4 pa-md-5">
          <div class="text-subtitle-1 font-weight-bold mb-3">Find Students</div>

          <div class="d-flex flex-column flex-md-row ga-3 mb-2">
            <v-text-field
              v-model="search"
              label="Search students"
              placeholder="Search by display name"
              prepend-inner-icon="mdi-magnify"
              hide-details
              class="flex-grow-1"
              @keyup.enter="runSearch"
            />

            <v-btn
              color="primary"
              rounded="pill"
              size="large"
              :loading="searchLoading"
              @click="runSearch"
            >
              Search
            </v-btn>
          </div>

          <div class="text-body-2 text-medium-emphasis mb-4">
            Leave the search blank to browse available students.
          </div>

          <v-alert
            v-if="searchError"
            type="error"
            variant="tonal"
            class="mb-4"
          >
            {{ searchError }}
          </v-alert>

          <div v-if="searchLoading" class="empty-wrap">
            <v-progress-circular indeterminate color="primary" />
            <div class="mt-3 text-medium-emphasis">Searching students...</div>
          </div>

          <v-alert
            v-else-if="searchTouched && !searchResults.length"
            type="info"
            variant="tonal"
          >
            No matching students found.
          </v-alert>

          <v-row v-else-if="searchResults.length" dense>
            <v-col
              v-for="student in searchResults"
              :key="student.id"
              cols="12"
            >
              <v-card rounded="xl" elevation="1" class="student-card">
                <v-card-text class="pa-4">
                  <div class="d-flex flex-column flex-md-row justify-space-between align-start ga-4">
                    <div class="d-flex align-center ga-3 min-w-0">
                      <v-avatar color="primary" variant="tonal" size="48">
                        {{ studentInitial(student.display_name) }}
                      </v-avatar>

                      <div class="min-w-0">
                        <div class="text-subtitle-1 font-weight-bold text-truncate">
                          {{ student.display_name || 'Unnamed student' }}
                        </div>
                        <div class="text-body-2 text-medium-emphasis">
                          {{ studentMeta(student) }}
                        </div>
                      </div>
                    </div>

                    <v-btn
                      color="primary"
                      rounded="pill"
                      :loading="addingStudentId === student.id"
                      @click="addStudent(student.id)"
                    >
                      Enroll
                    </v-btn>
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>
    </v-expand-transition>

    <div v-if="enrolledLoading" class="empty-wrap">
      <v-progress-circular indeterminate color="primary" />
      <div class="mt-3 text-medium-emphasis">Loading enrolled students...</div>
    </div>

    <v-alert
      v-else-if="enrolledError"
      type="error"
      variant="tonal"
    >
      {{ enrolledError }}
    </v-alert>

    <v-alert
      v-else-if="!filteredEnrolled.length"
      type="info"
      variant="tonal"
    >
      No enrolled students yet.
    </v-alert>

    <v-row v-else dense>
      <v-col
        v-for="item in filteredEnrolled"
        :key="item.id"
        cols="12"
      >
        <v-card rounded="xl" elevation="1" class="enrollment-card">
          <v-card-text class="pa-4">
            <div class="d-flex flex-column flex-md-row justify-space-between align-start ga-4">
              <div class="d-flex align-center ga-3 min-w-0">
                <v-avatar color="secondary" variant="tonal" size="48">
                  {{ studentInitial(item.student?.display_name) }}
                </v-avatar>

                <div class="min-w-0">
                  <div class="text-subtitle-1 font-weight-bold text-truncate">
                    {{ item.student?.display_name || 'Unnamed student' }}
                  </div>
                  <div class="text-body-2 text-medium-emphasis">
                    {{ studentMeta(item.student) }}
                  </div>
                </div>
              </div>

              <div class="d-flex align-center flex-wrap ga-2 w-100 w-md-auto justify-end">
                <v-chip color="success" variant="tonal" rounded="pill" size="small">
                  {{ item.enrollment_status || 'ACTIVE' }}
                </v-chip>

                <v-btn
                  v-if="canManage"
                  color="error"
                  rounded="pill"
                  :loading="removingEnrollmentId === item.id"
                  @click="dropEnrollment(item.id)"
                >
                  Drop
                </v-btn>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<style scoped>
.enrollment-manager {
  width: 100%;
}

.search-panel,
.student-card,
.enrollment-card {
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: linear-gradient(180deg, #ffffff 0%, #fbfcff 100%);
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

@media (max-width: 960px) {
  .w-md-auto {
    width: 100%;
  }

  .text-truncate {
    white-space: normal;
  }
}
</style>