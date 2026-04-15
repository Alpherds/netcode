import { createError, getCookie, getRouterParam } from 'h3'

type SessionRecord = {
  id: number
  documentId?: string
  title?: string
  starts_at?: string
  ends_at?: string
  room_name?: string
  meeting_provider?: string
  meeting_status?: string
  notes?: string
  classroom?: {
    id?: number
    title?: string
    code?: string
    term?: string
    [key: string]: unknown
  } | null
  [key: string]: unknown
}

type StrapiCollectionResponse<T> = {
  data: T[]
}

export default defineEventHandler(async (event): Promise<SessionRecord> => {
  const config = useRuntimeConfig(event)
  const jwt = getCookie(event, 'netcode_jwt')
  const id = getRouterParam(event, 'id')

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

  try {
    const response = await $fetch<StrapiCollectionResponse<SessionRecord>>(
      `${config.public.strapiUrl}/api/class-sessions?filters[id][$eq]=${id}&populate=classroom`,
      {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      }
    )

    const session = response.data?.[0]

    if (!session) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Session not found',
      })
    }

    return session
  } catch (error: any) {
    throw createError({
      statusCode: error?.statusCode || 500,
      statusMessage:
        error?.data?.error?.message || 'Failed to load session',
    })
  }
})