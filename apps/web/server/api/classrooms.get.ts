import { createError, getCookie } from 'h3'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const jwt = getCookie(event, 'netcode_jwt')

  if (!jwt) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const response = await $fetch<any>(
    `${config.public.strapiUrl}/api/classrooms?populate=*`,
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    }
  )

  return response?.data ?? []
})