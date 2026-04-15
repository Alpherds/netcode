import { createError, getCookie, getRouterParam } from 'h3'

type ClassroomRecord = {
  id: number
  documentId?: string
  title?: string
  code?: string
  description?: string
  term?: string
  class_status?: string
  [key: string]: unknown
}

type StrapiCollectionResponse<T> = {
  data: T[]
}

export default defineEventHandler(async (event): Promise<ClassroomRecord> => {
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

  const response = await $fetch<StrapiCollectionResponse<ClassroomRecord>>(
    `${config.public.strapiUrl}/api/classrooms?filters[id][$eq]=${id}&populate=*`,
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    }
  )

  const classroom = response.data?.[0]

  if (!classroom) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Classroom not found',
    })
  }

  return classroom
})