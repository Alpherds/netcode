import { createError, getCookie, getRouterParam } from 'h3'

type SessionStatus = 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED'

type StrapiCollectionResponse<T> = {
  data: T[]
}

type StrapiSingleResponse<T> = {
  data: T
}

type StrapiMe = {
  id: number
  username: string
  email?: string
}

type ProfileRecord = {
  id: number
  documentId?: string
  display_name?: string
  role_label?: string
  auth_user_id?: number
  [key: string]: unknown
}

type SessionRecord = {
  id: number
  documentId?: string
  meeting_status?: SessionStatus
  classroom?: {
    id?: number
    [key: string]: unknown
  } | null
  [key: string]: unknown
}

type EnrollmentRecord = {
  id: number
  documentId?: string
  enrollment_status?: string | null
  [key: string]: unknown
}

type ClassroomRecord = {
  id: number
  documentId?: string
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

type AttendanceResult = {
  tracked: boolean
  reason?: string
  attendance?: AttendanceRecord
}

export default defineEventHandler(async (event): Promise<AttendanceResult> => {
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

  if (session.meeting_status !== 'LIVE') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Attendance can only be logged for a live session',
    })
  }

  const roleLabel = String(profile.role_label || '').toUpperCase()

  if (roleLabel === 'ADMIN' || roleLabel === 'INSTRUCTOR') {
    const classroomResponse = await $fetch<StrapiCollectionResponse<ClassroomRecord>>(
      `${strapiUrl}/api/classrooms?filters[id][$eq]=${classroomId}&filters[instructor][id][$eq]=${profile.id}`,
      { headers }
    )

    if (roleLabel === 'INSTRUCTOR' && !classroomResponse.data?.[0]) {
      throw createError({
        statusCode: 403,
        statusMessage: 'You do not have access to this session',
      })
    }

    return {
      tracked: false,
      reason: 'Attendance is only tracked for students',
    }
  }

  if (roleLabel !== 'STUDENT') {
    throw createError({
      statusCode: 403,
      statusMessage: 'You do not have access to this session',
    })
  }

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

  const existingResponse = await $fetch<StrapiCollectionResponse<AttendanceRecord>>(
    `${strapiUrl}/api/attendances?filters[class_session][id][$eq]=${sessionId}&filters[student][id][$eq]=${profile.id}&populate=student`,
    { headers }
  )

  const existing = existingResponse.data?.[0]
  const nowIso = new Date().toISOString()

  if (existing?.documentId) {
    const updated = await $fetch<StrapiSingleResponse<AttendanceRecord>>(
      `${strapiUrl}/api/attendances/${existing.documentId}?populate=student`,
      {
        method: 'PUT',
        headers,
        body: {
          data: {
            join_time: existing.join_time || nowIso,
            leave_time: null,
            attendance_status: 'PRESENT',
            source: 'PROVIDER_EVENT',
          },
        },
      }
    )

    return {
      tracked: true,
      attendance: updated.data,
    }
  }

  const created = await $fetch<StrapiSingleResponse<AttendanceRecord>>(
    `${strapiUrl}/api/attendances?populate=student`,
    {
      method: 'POST',
      headers,
      body: {
        data: {
          join_time: nowIso,
          attendance_status: 'PRESENT',
          source: 'PROVIDER_EVENT',
          class_session: Number(sessionId),
          student: profile.id,
        },
      },
    }
  )

  return {
    tracked: true,
    attendance: created.data,
  }
})