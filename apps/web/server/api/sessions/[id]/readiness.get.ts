import { createError, getCookie, getRouterParam } from 'h3'

type StrapiCollectionResponse<T> = {
  data: T[]
}

type StrapiMe = {
  id: number
  username: string
}

type ProfileRecord = {
  id: number
  role_label?: string | null
  auth_user_id?: number | null
  display_name?: string | null
  student_no?: string | null
  program?: string | null
  year_level?: string | null
  section?: string | null
  [key: string]: unknown
}

type SessionRecord = {
  id: number
  classroom?: {
    id?: number
    [key: string]: unknown
  } | null
  [key: string]: unknown
}

type ClassroomRecord = {
  id: number
  [key: string]: unknown
}

type EnrollmentRecord = {
  id: number
  student?: ProfileRecord | null
  [key: string]: unknown
}

type AttendanceRecord = {
  id: number
  join_time?: string | null
  leave_time?: string | null
  attendance_status?: string | null
  student?: ProfileRecord | null
  [key: string]: unknown
}

type ReadinessRow = {
  student: ProfileRecord
  readiness_state: 'WAITING' | 'JOINED' | 'LEFT'
  attendance_status: string | null
  join_time: string | null
  leave_time: string | null
}

type ReadinessResponse = {
  totalEnrolled: number
  joinedCount: number
  waitingCount: number
  leftCount: number
  rows: ReadinessRow[]
}

export default defineEventHandler(async (event): Promise<ReadinessResponse> => {
  const config = useRuntimeConfig(event)
  const jwt = getCookie(event, 'netcode_jwt')
  const sessionId = getRouterParam(event, 'id')

  if (!jwt) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  if (!sessionId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Session id is required',
    })
  }

  const strapiUrl = String(config.public.strapiUrl || '').replace(/\/$/, '')
  const headers = { Authorization: `Bearer ${jwt}` }

  const me = await $fetch<StrapiMe>(`${strapiUrl}/api/users/me`, { headers })

  const profileRes = await $fetch<StrapiCollectionResponse<ProfileRecord>>(
    `${strapiUrl}/api/profiles?filters[auth_user_id][$eq]=${me.id}`,
    { headers }
  )

  const profile = profileRes.data?.[0]

  if (!profile) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Profile not found',
    })
  }

  const role = String(profile.role_label || '').toUpperCase()

  if (role !== 'ADMIN' && role !== 'INSTRUCTOR') {
    throw createError({
      statusCode: 403,
      statusMessage: 'You do not have access to participant readiness',
    })
  }

  const sessionRes = await $fetch<StrapiCollectionResponse<SessionRecord>>(
    `${strapiUrl}/api/class-sessions?filters[id][$eq]=${sessionId}&populate=classroom`,
    { headers }
  )

  const session = sessionRes.data?.[0]
  const classroomId = session?.classroom?.id

  if (!session || !classroomId) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Session not found',
    })
  }

  if (role === 'INSTRUCTOR') {
    const classroomRes = await $fetch<StrapiCollectionResponse<ClassroomRecord>>(
      `${strapiUrl}/api/classrooms?filters[id][$eq]=${classroomId}&filters[instructor][id][$eq]=${profile.id}`,
      { headers }
    )

    if (!classroomRes.data?.[0]) {
      throw createError({
        statusCode: 403,
        statusMessage: 'You do not own this classroom',
      })
    }
  }

  const enrollmentRes = await $fetch<StrapiCollectionResponse<EnrollmentRecord>>(
    `${strapiUrl}/api/enrollments?filters[classroom][id][$eq]=${classroomId}&filters[enrollment_status][$eq]=ACTIVE&populate=student&sort[0]=id:asc`,
    { headers }
  )

  const attendanceRes = await $fetch<StrapiCollectionResponse<AttendanceRecord>>(
    `${strapiUrl}/api/attendances?filters[class_session][id][$eq]=${sessionId}&populate=student&sort[0]=join_time:asc`,
    { headers }
  )

  const attendanceMap = new Map<number, AttendanceRecord>()

  for (const item of attendanceRes.data || []) {
    const studentId = item.student?.id
    if (studentId && !attendanceMap.has(studentId)) {
      attendanceMap.set(studentId, item)
    }
  }

  const rows: ReadinessRow[] = []

  for (const enrollment of enrollmentRes.data || []) {
    const student = enrollment.student

    if (!student?.id) continue

    const attendance = attendanceMap.get(student.id)

    const readinessState: 'WAITING' | 'JOINED' | 'LEFT' =
      attendance
        ? String(attendance.attendance_status || '').toUpperCase() === 'LEFT'
          ? 'LEFT'
          : 'JOINED'
        : 'WAITING'

    rows.push({
      student,
      readiness_state: readinessState,
      attendance_status: attendance?.attendance_status ?? null,
      join_time: attendance?.join_time ?? null,
      leave_time: attendance?.leave_time ?? null,
    })
  }

  const totalEnrolled = rows.length
  const joinedCount = rows.filter((item) => item.readiness_state === 'JOINED').length
  const waitingCount = rows.filter((item) => item.readiness_state === 'WAITING').length
  const leftCount = rows.filter((item) => item.readiness_state === 'LEFT').length

  return {
    totalEnrolled,
    joinedCount,
    waitingCount,
    leftCount,
    rows,
  }
})