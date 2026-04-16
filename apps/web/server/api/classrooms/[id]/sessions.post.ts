import { createError, getCookie, getRouterParam, readBody } from 'h3'

type SessionStatus = 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED'

type CreateSessionBody = {
  title?: string
  starts_at?: string
  ends_at?: string
  room_name?: string
  meeting_provider?: 'DAILY'
  meeting_status?: SessionStatus
  notes?: string
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
  term?: string | null
  class_status?: 'OPEN' | 'CLOSED' | 'ARCHIVED' | string | null
  [key: string]: unknown
}

type CreatedSession = {
  id: number
  documentId?: string
  title?: string | null
  starts_at?: string | null
  ends_at?: string | null
  room_name?: string | null
  meeting_provider?: string | null
  meeting_status?: string | null
  notes?: string | null
  classroom?: ClassroomRecord | null
  [key: string]: unknown
}

const toIso = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export default defineEventHandler(async (event): Promise<CreatedSession> => {
  const config = useRuntimeConfig(event)
  const jwt = getCookie(event, 'netcode_jwt')
  const classroomId = getRouterParam(event, 'id')
  const body = await readBody<CreateSessionBody>(event)

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

  if (!body?.title?.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Session title is required',
    })
  }

  if (!body?.starts_at || !body?.ends_at) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Start and end date/time are required',
    })
  }

  const startsAtIso = toIso(body.starts_at)
  const endsAtIso = toIso(body.ends_at)

  if (!startsAtIso || !endsAtIso) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid start or end date/time',
    })
  }

  if (new Date(startsAtIso).getTime() >= new Date(endsAtIso).getTime()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'End time must be later than start time',
    })
  }

  const allowedStatuses: SessionStatus[] = ['SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED']
  const meetingStatus = body.meeting_status || 'SCHEDULED'

  if (!allowedStatuses.includes(meetingStatus)) {
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

  if (roleLabel !== 'INSTRUCTOR' && roleLabel !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      statusMessage: 'You do not have permission to create a session',
    })
  }

  const classroomLookupUrl =
    roleLabel === 'INSTRUCTOR'
      ? `${strapiUrl}/api/classrooms?filters[id][$eq]=${classroomId}&filters[instructor][id][$eq]=${profile.id}`
      : `${strapiUrl}/api/classrooms?filters[id][$eq]=${classroomId}`

  const classroomResponse = await $fetch<StrapiCollectionResponse<ClassroomRecord>>(
    classroomLookupUrl,
    { headers }
  )

  const classroom = classroomResponse.data?.[0]

  if (!classroom) {
    throw createError({
      statusCode: roleLabel === 'INSTRUCTOR' ? 403 : 404,
      statusMessage:
        roleLabel === 'INSTRUCTOR'
          ? 'You do not own this classroom'
          : 'Classroom not found',
    })
  }

  if (String(classroom.class_status || '').toUpperCase() !== 'OPEN') {
    throw createError({
      statusCode: 403,
      statusMessage: 'You can only create sessions for an OPEN classroom',
    })
  }

  try {
    const response = await $fetch<StrapiSingleResponse<CreatedSession>>(
      `${strapiUrl}/api/class-sessions`,
      {
        method: 'POST',
        headers,
        body: {
          data: {
            title: body.title.trim(),
            starts_at: startsAtIso,
            ends_at: endsAtIso,
            room_name: body.room_name?.trim() || `class-${classroomId}-room`,
            meeting_provider: body.meeting_provider || 'DAILY',
            meeting_status: meetingStatus,
            notes: body.notes?.trim() || '',
            classroom: Number(classroomId),
          },
        },
      }
    )

    return response.data
  } catch (error: any) {
    throw createError({
      statusCode: error?.statusCode || 500,
      statusMessage:
        error?.data?.error?.message ||
        error?.data?.message ||
        'Failed to create session',
    })
  }
})