import { createError, getCookie, getRouterParam } from 'h3'

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

  const roleLabel = String(profile.role_label || '').toUpperCase()

  if (roleLabel !== 'STUDENT') {
    return {
      tracked: false,
      reason: 'Attendance is only tracked for students',
    }
  }

  const existingResponse = await $fetch<StrapiCollectionResponse<AttendanceRecord>>(
    `${strapiUrl}/api/attendances?filters[class_session][id][$eq]=${sessionId}&filters[student][id][$eq]=${profile.id}&populate=student`,
    { headers }
  )

  const existing = existingResponse.data?.[0]

  if (!existing?.documentId) {
    return {
      tracked: false,
      reason: 'No attendance record found for this student/session',
    }
  }

  const updated = await $fetch<StrapiSingleResponse<AttendanceRecord>>(
    `${strapiUrl}/api/attendances/${existing.documentId}?populate=student`,
    {
      method: 'PUT',
      headers,
      body: {
        data: {
          leave_time: new Date().toISOString(),
          attendance_status: 'LEFT',
          source: 'PROVIDER_EVENT',
        },
      },
    }
  )

  return {
    tracked: true,
    attendance: updated.data,
  }
})