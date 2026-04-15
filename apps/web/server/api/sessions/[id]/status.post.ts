import { createError, getCookie, getRouterParam, readBody } from 'h3'

type SessionStatus = 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED'

type StatusBody = {
  meeting_status: SessionStatus
}

type SessionRecord = {
  id: number
  documentId?: string
  title?: string
  starts_at?: string
  ends_at?: string
  room_name?: string
  meeting_provider?: string
  meeting_status?: SessionStatus
  notes?: string
  [key: string]: unknown
}

type StrapiCollectionResponse<T> = {
  data: T[]
}

type StrapiSingleResponse<T> = {
  data: T
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

  const existing = await $fetch<StrapiCollectionResponse<SessionRecord>>(
    `${config.public.strapiUrl}/api/class-sessions?filters[id][$eq]=${id}&populate=*`,
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    }
  )

  const session = existing.data?.[0]

  if (!session?.documentId) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Session not found',
    })
  }

  const updated = await $fetch<StrapiSingleResponse<SessionRecord>>(
    `${config.public.strapiUrl}/api/class-sessions/${session.documentId}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
      body: {
        data: {
          meeting_status: body.meeting_status,
        },
      },
    }
  )

  return updated.data
})