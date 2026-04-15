import { createError, getCookie, getRouterParam } from 'h3'

type SessionRecord = {
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

type StrapiCollectionResponse<T> = {
  data: T[]
}

export default defineEventHandler(async (event): Promise<SessionRecord[]> => {
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
      statusMessage: 'Classroom id is required',
    })
  }

  const response = await $fetch<StrapiCollectionResponse<SessionRecord>>(
    `${config.public.strapiUrl}/api/class-sessions?filters[classroom][id][$eq]=${id}&sort=starts_at:asc&populate=*`,
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    }
  )

  return response.data ?? []
})