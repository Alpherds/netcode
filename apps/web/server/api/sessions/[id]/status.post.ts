import { createError, getCookie, getRouterParam, readBody } from 'h3'

type SessionStatus = 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED'

type StatusBody = {
  meeting_status: SessionStatus
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

type ClassroomRef = {
  id?: number
  title?: string | null
  code?: string | null
  term?: string | null
  [key: string]: unknown
}

type ClassroomRecord = {
  id: number
  documentId?: string
  instructor?: ProfileRecord | null
  [key: string]: unknown
}

type SessionRecord = {
  id: number
  documentId?: string
  title?: string | null
  starts_at?: string | null
  ends_at?: string | null
  room_name?: string | null
  meeting_provider?: string | null
  meeting_status?: SessionStatus | null
  notes?: string | null
  classroom?: ClassroomRef | null
  [key: string]: unknown
}

export default defineEventHandler(async (event): Promise<SessionRecord> => {
  const config = useRuntimeConfig(event)
  const jwt = getCookie(event, 'netcode_jwt')
  const id = getRouterParam(event, 'id')
  const body = await readBody<StatusBody>(event)

  if (!jwt) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Session id is required',
    })
  }

  if (!body?.meeting_status) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Meeting status is required',
    })
  }

  const allowed: SessionStatus[] = ['SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED']

  if (!allowed.includes(body.meeting_status)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid meeting status',
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

  if (roleLabel !== 'ADMIN' && roleLabel !== 'INSTRUCTOR') {
    throw createError({
      statusCode: 403,
      statusMessage: 'You do not have permission to update session status',
    })
  }

  const existing = await $fetch<StrapiCollectionResponse<SessionRecord>>(
    `${strapiUrl}/api/class-sessions?filters[id][$eq]=${id}&populate=classroom`,
    { headers }
  )

  const session = existing.data?.[0]

  if (!session?.documentId) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Session not found',
    })
  }

  const classroomId = session.classroom?.id

  if (!classroomId) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Session classroom not found',
    })
  }

  if (roleLabel === 'INSTRUCTOR') {
    const classroomResponse = await $fetch<StrapiCollectionResponse<ClassroomRecord>>(
      `${strapiUrl}/api/classrooms?filters[id][$eq]=${classroomId}&filters[instructor][id][$eq]=${profile.id}&populate=instructor`,
      { headers }
    )

    if (!classroomResponse.data?.[0]) {
      throw createError({
        statusCode: 403,
        statusMessage: 'You do not own this classroom session',
      })
    }
  }

  await $fetch<StrapiSingleResponse<SessionRecord>>(
    `${strapiUrl}/api/class-sessions/${session.documentId}`,
    {
      method: 'PUT',
      headers,
      body: {
        data: {
          meeting_status: body.meeting_status,
        },
      },
    }
  )

  const refreshed = await $fetch<StrapiCollectionResponse<SessionRecord>>(
    `${strapiUrl}/api/class-sessions?filters[id][$eq]=${id}&populate=classroom`,
    { headers }
  )

  const updatedSession = refreshed.data?.[0]

  if (!updatedSession) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Updated session not found',
    })
  }

  return updatedSession
})