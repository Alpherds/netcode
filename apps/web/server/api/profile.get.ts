import { createError, getCookie } from 'h3'

type SessionUser = {
  id: number
  username: string
  email: string
}

type ProfileRecord = {
  id: number
  display_name?: string
  role_label?: string
  auth_user_id?: number
  [key: string]: unknown
}

type StrapiCollectionResponse<T> = {
  data: T[]
}

export default defineEventHandler(async (event): Promise<ProfileRecord | null> => {
  const config = useRuntimeConfig(event)
  const jwt = getCookie(event, 'netcode_jwt')
  const rawUser = getCookie(event, 'netcode_user')

  if (!jwt || !rawUser) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const user = JSON.parse(decodeURIComponent(rawUser)) as SessionUser

  const response = await $fetch<StrapiCollectionResponse<ProfileRecord>>(
    `${config.public.strapiUrl}/api/profiles?filters[auth_user_id][$eq]=${user.id}`,
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    }
  )

  return response.data[0] ?? null
})