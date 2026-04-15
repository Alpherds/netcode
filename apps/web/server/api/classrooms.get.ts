import { createError, getCookie } from 'h3'

type ClassroomRecord = {
  id: number
  title?: string
  code?: string
  term?: string
  class_status?: string
  [key: string]: unknown
}

type StrapiCollectionResponse<T> = {
  data: T[]
}

export default defineEventHandler(async (event): Promise<ClassroomRecord[]> => {
  const config = useRuntimeConfig(event)
  const jwt = getCookie(event, 'netcode_jwt')

  if (!jwt) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const response = await $fetch<StrapiCollectionResponse<ClassroomRecord>>(
    `${config.public.strapiUrl}/api/classrooms?populate=*`,
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    }
  )

  return response.data ?? []
})