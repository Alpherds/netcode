import { createError, getCookie } from 'h3'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const jwt = getCookie(event, 'netcode_jwt')
  const rawUser = getCookie(event, 'netcode_user')

  if (!jwt || !rawUser) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const user = JSON.parse(decodeURIComponent(rawUser))

  const response = await $fetch<any>(
    `${config.public.strapiUrl}/api/profiles?filters[auth_user_id][$eq]=${user.id}`,
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    }
  )

  return response?.data?.[0] ?? null
})