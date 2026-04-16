import { createError, getCookie, getRouterParam, readBody } from 'h3'

type ClassroomStatus = 'OPEN' | 'CLOSED' | 'ARCHIVED'
type SessionStatus = 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED'

type StatusBody = {
  class_status?: ClassroomStatus
}

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
  display_name?: string | null
  role_label?: string | null
  auth_user_id?: number | null
  [key: string]: unknown
}

type ClassroomRecord = {
  id: number
  documentId?: string
  title?: string | null
  code?: string | null
  description?: string | null
  term?: string | null
  class_status?: ClassroomStatus | null
  instructor?: ProfileRecord | null
  [key: string]: unknown
}

type SessionRecord = {
  id: number
  documentId?: string
  title?: string | null
  meeting_status?: SessionStatus | null
  [key: string]: unknown
}

export default defineEventHandler(async (event): Promise<ClassroomRecord> => {
  const config = useRuntimeConfig(event)
  const jwt = getCookie(event, 'netcode_jwt')
  const classroomId = getRouterParam(event, 'id')
  const body = await readBody<StatusBody>(event)

  if (!jwt) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  if (!classroomId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Classroom id is required',
    })
  }

  const nextStatus = body?.class_status

  if (!nextStatus) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Classroom status is required',
    })
  }

  const allowedStatuses: ClassroomStatus[] = ['OPEN', 'CLOSED', 'ARCHIVED']

  if (!allowedStatuses.includes(nextStatus)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid classroom status',
    })
  }

  const strapiUrl = String(config.public.strapiUrl || '').replace(/\/$/, '')
  const headers = {
    Authorization: `Bearer ${jwt}`,
  }

  const me = await $fetch<StrapiMe>(`${strapiUrl}/api/users/me`, {
    headers,
  })

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

  if (roleLabel !== 'INSTRUCTOR' && roleLabel !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      statusMessage: 'You do not have permission to update classroom status',
    })
  }

  const existingResponse = await $fetch<StrapiCollectionResponse<ClassroomRecord>>(
    roleLabel === 'INSTRUCTOR'
      ? `${strapiUrl}/api/classrooms?filters[id][$eq]=${classroomId}&filters[instructor][id][$eq]=${profile.id}&populate=instructor`
      : `${strapiUrl}/api/classrooms?filters[id][$eq]=${classroomId}&populate=instructor`,
    { headers }
  )

  const classroom = existingResponse.data?.[0]

  if (!classroom?.documentId) {
    throw createError({
      statusCode: roleLabel === 'INSTRUCTOR' ? 403 : 404,
      statusMessage:
        roleLabel === 'INSTRUCTOR'
          ? 'You do not own this classroom'
          : 'Classroom not found',
    })
  }

  if (nextStatus === 'ARCHIVED') {
    const sessionsResponse = await $fetch<StrapiCollectionResponse<SessionRecord>>(
      `${strapiUrl}/api/class-sessions?filters[classroom][id][$eq]=${classroomId}&sort[0]=starts_at:asc`,
      { headers }
    )

    const hasActiveSessions = (sessionsResponse.data || []).some((session) => {
      const status = String(session.meeting_status || '').toUpperCase()
      return status === 'SCHEDULED' || status === 'LIVE'
    })

    if (hasActiveSessions) {
      throw createError({
        statusCode: 409,
        statusMessage: 'You cannot archive a classroom with active sessions',
      })
    }
  }

  await $fetch<StrapiSingleResponse<ClassroomRecord>>(
    `${strapiUrl}/api/classrooms/${classroom.documentId}`,
    {
      method: 'PUT',
      headers,
      body: {
        data: {
          class_status: nextStatus,
        },
      },
    }
  )

  const refreshedResponse = await $fetch<StrapiCollectionResponse<ClassroomRecord>>(
    `${strapiUrl}/api/classrooms?filters[id][$eq]=${classroomId}&populate=instructor`,
    { headers }
  )

  const updatedClassroom = refreshedResponse.data?.[0]

  if (!updatedClassroom) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Updated classroom not found',
    })
  }

  return updatedClassroom
})