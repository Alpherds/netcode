<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

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

const filteredEnrolled = computed(() => enrolled.value ?? [])

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
    search.value = ''
    searchResults.value = []
    searchError.value = ''
    searchTouched.value = false
  }
}

const addStudent = async (studentId: number) => {
  addingStudentId.value = studentId

  try {
    await $fetch(`/api/classrooms/${props.classroomId}/enrollments`, {
      method: 'POST',
      body: { studentId },
    })

    await loadEnrollments()
    await runSearch()
  } catch (error: any) {
    searchError.value =
      error?.data?.message ||
      error?.statusMessage ||
      'Failed to enroll student.'
  } finally {
    addingStudentId.value = null
  }
}

const dropEnrollment = async (enrollmentId: number) => {
  removingEnrollmentId.value = enrollmentId

  try {
    await $fetch(`/api/enrollments/${enrollmentId}/drop`, {
      method: 'POST',
    })

    await loadEnrollments()

    if (showAddStudent.value) {
      await runSearch()
    }
  } catch (error: any) {
    enrolledError.value =
      error?.data?.message ||
      error?.statusMessage ||
      'Failed to drop student.'
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
</script>

<template>
  <section class="panel">
    <div class="panel-header">
      <div>
        <h2>Enrollments</h2>
        <p class="panel-subtitle">
          Manage which students can access this classroom and its live sessions.
        </p>
      </div>

      <div class="panel-actions">
        <span class="count">{{ filteredEnrolled.length }}</span>

        <button
          v-if="canManage"
          class="btn btn-secondary"
          @click="toggleAddStudent"
        >
          {{ showAddStudent ? 'Close Add Student' : 'Add Student' }}
        </button>
      </div>
    </div>

    <div v-if="canManage && showAddStudent" class="search-panel">
      <label>Find Students</label>

      <div class="search-row">
        <input
          v-model="search"
          type="text"
          placeholder="Search by display name"
          @keyup.enter="runSearch"
        />
        <button
          class="btn btn-primary"
          :disabled="searchLoading"
          @click="runSearch"
        >
          {{ searchLoading ? 'Searching...' : 'Search' }}
        </button>
      </div>

      <p class="helper">
        Leave the search blank to browse available students.
      </p>

      <p v-if="searchError" class="helper error-text">{{ searchError }}</p>

      <div v-if="searchLoading" class="empty-state">
        Searching students...
      </div>

      <div
        v-else-if="searchTouched && !searchResults.length"
        class="empty-state"
      >
        No matching students found.
      </div>

      <div v-else-if="searchResults.length" class="student-results">
        <article
          v-for="student in searchResults"
          :key="student.id"
          class="student-card"
        >
          <div>
            <strong>{{ student.display_name || 'Unnamed student' }}</strong>
            <p>
              {{ student.student_no || 'No student number' }}
              <span v-if="student.program"> · {{ student.program }}</span>
              <span v-if="student.year_level"> · {{ student.year_level }}</span>
              <span v-if="student.section"> · {{ student.section }}</span>
            </p>
          </div>

          <button
            class="btn btn-secondary"
            :disabled="addingStudentId === student.id"
            @click="addStudent(student.id)"
          >
            {{ addingStudentId === student.id ? 'Adding...' : 'Enroll' }}
          </button>
        </article>
      </div>
    </div>

    <div v-if="enrolledLoading" class="empty-state">
      Loading enrolled students...
    </div>

    <div v-else-if="enrolledError" class="empty-state error">
      {{ enrolledError }}
    </div>

    <div v-else-if="!filteredEnrolled.length" class="empty-state">
      No enrolled students yet.
    </div>

    <div v-else class="enrollment-list">
      <article
        v-for="item in filteredEnrolled"
        :key="item.id"
        class="enrollment-card"
      >
        <div>
          <strong>{{ item.student?.display_name || 'Unnamed student' }}</strong>
          <p>
            {{ item.student?.student_no || 'No student number' }}
            <span v-if="item.student?.program"> · {{ item.student.program }}</span>
            <span v-if="item.student?.year_level"> · {{ item.student.year_level }}</span>
            <span v-if="item.student?.section"> · {{ item.student.section }}</span>
          </p>
        </div>

        <button
          v-if="canManage"
          class="btn btn-danger"
          :disabled="removingEnrollmentId === item.id"
          @click="dropEnrollment(item.id)"
        >
          {{ removingEnrollmentId === item.id ? 'Dropping...' : 'Drop' }}
        </button>
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
  align-items: flex-start;
  gap: 16px;
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

.panel-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
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

.search-panel {
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  padding: 18px;
  background: #fafcff;
  margin-bottom: 18px;
}

.search-panel label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 700;
  color: #374151;
}

.search-row {
  display: flex;
  gap: 10px;
}

.search-row input {
  flex: 1;
  border: 1px solid #d1d5db;
  border-radius: 12px;
  padding: 12px 14px;
  font: inherit;
}

.helper {
  margin: 10px 0 0;
  font-size: 14px;
  color: #6b7280;
}

.error-text {
  color: #b91c1c;
}

.student-results,
.enrollment-list {
  display: grid;
  gap: 12px;
  margin-top: 14px;
}

.student-card,
.enrollment-card {
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 16px;
  background: #fcfdff;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.student-card p,
.enrollment-card p {
  margin: 6px 0 0;
  color: #6b7280;
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
  font-weight: 600;
  cursor: pointer;
}

.btn-primary {
  background: #111827;
  color: white;
}

.btn-secondary {
  background: #4f46e5;
  color: white;
}

.btn-danger {
  background: #dc2626;
  color: white;
}

@media (max-width: 800px) {
  .panel-header,
  .search-row,
  .student-card,
  .enrollment-card {
    flex-direction: column;
  }

  .student-card .btn,
  .enrollment-card .btn,
  .search-row .btn,
  .panel-actions .btn {
    width: 100%;
  }
}
</style>