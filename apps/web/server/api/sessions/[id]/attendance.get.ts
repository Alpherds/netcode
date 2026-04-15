import { createError, getCookie, getRouterParam } from 'h3'

type StrapiCollectionResponse<T> = {
  data: T[]
}

type StrapiMe = {
  id: number
  username: string
  email?: string
}

type ProfileRecord = {
  id: number
  documentId?: string
  display_name?: string | null
  role_label?: string | null
  auth_user_id?: number | null
  student_no?: string | null
  [key: string]: unknown
}

type ClassroomRef = {
  id?: number
  documentId?: string
  [key: string]: unknown
}

type SessionRecord = {
  id: number
  documentId?: string
  meeting_status?: string | null
  classroom?: ClassroomRef | null
  [key: string]: unknown
}

type ClassroomRecord = {
  id: number
  documentId?: string
  [key: string]: unknown
}

type EnrollmentRecord = {
  id: number
  documentId?: string
  enrollment_status?: string | null
  [key: string]: unknown
}

type AttendanceRecord = {
  id: number
  documentId?: string
  join_time?: string | null
  leave_time?: string | null
  attendance_status?: string | null
  source?: string | null
  student?: ProfileRecord | null
  [key: string]: unknown
}

export default defineEventHandler(async (event): Promise<AttendanceRecord[]> => {
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
  const headers = {
    Authorization: `Bearer ${jwt}`,
  }

  const me = await $fetch<StrapiMe>(`${strapiUrl}/api/users/me`, { headers })

  const profileResponse = await $fetch<StrapiCollectionResponse<ProfileRecord>>(
    `${strapiUrl}/api/profiles?filters[auth_user_id][$eq]=${me.id}`,
    { headers }
  )

  const profile = profileResponse.data?.[0]

  if (!profile) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Profile not found',
    })
  }

  const sessionResponse = await $fetch<StrapiCollectionResponse<SessionRecord>>(
    `${strapiUrl}/api/class-sessions?filters[id][$eq]=${sessionId}&populate=classroom`,
    { headers }
  )

  const session = sessionResponse.data?.[0]
  const classroomId = session?.classroom?.id

  if (!session || !classroomId) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Session not found',
    })
  }

  const roleLabel = String(profile.role_label || '').toUpperCase()

  if (roleLabel === 'ADMIN') {
    const response = await $fetch<StrapiCollectionResponse<AttendanceRecord>>(
      `${strapiUrl}/api/attendances?filters[class_session][id][$eq]=${sessionId}&populate=student&sort[0]=join_time:asc`,
      { headers }
    )

    return response.data || []
  }

  if (roleLabel === 'INSTRUCTOR') {
    const classroomResponse = await $fetch<StrapiCollectionResponse<ClassroomRecord>>(
      `${strapiUrl}/api/classrooms?filters[id][$eq]=${classroomId}&filters[instructor][id][$eq]=${profile.id}`,
      { headers }
    )

    if (!classroomResponse.data?.[0]) {
      throw createError({
        statusCode: 403,
        statusMessage: 'You do not have access to this attendance list',
      })
    }

    const response = await $fetch<StrapiCollectionResponse<AttendanceRecord>>(
      `${strapiUrl}/api/attendances?filters[class_session][id][$eq]=${sessionId}&populate=student&sort[0]=join_time:asc`,
      { headers }
    )

    return response.data || []
  }

  if (roleLabel === 'STUDENT') {
    const enrollmentResponse = await $fetch<StrapiCollectionResponse<EnrollmentRecord>>(
      `${strapiUrl}/api/enrollments?filters[student][id][$eq]=${profile.id}&filters[classroom][id][$eq]=${classroomId}&filters[enrollment_status][$eq]=ACTIVE`,
      { headers }
    )

    if (!enrollmentResponse.data?.[0]) {
      throw createError({
        statusCode: 403,
        statusMessage: 'You are not enrolled in this session classroom',
      })
    }

    const response = await $fetch<StrapiCollectionResponse<AttendanceRecord>>(
      `${strapiUrl}/api/attendances?filters[class_session][id][$eq]=${sessionId}&filters[student][id][$eq]=${profile.id}&populate=student&sort[0]=join_time:asc`,
      { headers }
    )

    return response.data || []
  }

  throw createError({
    statusCode: 403,
    statusMessage: 'You do not have access to this attendance list',
  })
})