import { createError, getCookie } from 'h3'

type StrapiMe = {
  id: number
  username: string
  email?: string
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

  if (!jwt) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const strapiUrl = String(config.public.strapiUrl || '').replace(/\/$/, '')
  const headers = {
    Authorization: `Bearer ${jwt}`,
  }

  const me = await $fetch<StrapiMe>(`${strapiUrl}/api/users/me`, {
    headers,
  })

  const response = await $fetch<StrapiCollectionResponse<ProfileRecord>>(
    `${strapiUrl}/api/profiles?filters[auth_user_id][$eq]=${me.id}`,
    { headers }
  )

  return response.data?.[0] ?? null
})