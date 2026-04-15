import { createError, getCookie, getRouterParam, readBody } from 'h3'

type CreateSessionBody = {
  title: string
  starts_at: string
  ends_at: string
  room_name?: string
  meeting_provider?: 'JITSI'
  meeting_status?: 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED'
  notes?: string
}

type StrapiCreateResponse<T> = {
  data: T
}

type CreatedSession = {
  id: number
  title?: string
  starts_at?: string
  ends_at?: string
  room_name?: string
  meeting_provider?: string
  meeting_status?: string
  notes?: string
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

  try {
    const response = await $fetch<StrapiCreateResponse<CreatedSession>>(
      `${config.public.strapiUrl}/api/class-sessions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
        body: {
          data: {
            title: body.title.trim(),
            starts_at: startsAtIso,
            ends_at: endsAtIso,
            room_name: body.room_name?.trim() || `class-${classroomId}-room`,
            meeting_provider: body.meeting_provider || 'JITSI',
            meeting_status: body.meeting_status || 'SCHEDULED',
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
        error?.data?.error?.message || 'Failed to create session',
    })
  }
})