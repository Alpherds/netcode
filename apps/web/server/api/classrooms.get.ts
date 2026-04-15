import { createError, getCookie } from 'h3'

type SessionUser = {
  id: number
  username: string
  email: string
}

type ProfileRecord = {
  id: number
  auth_user_id?: number
  role_label?: string
  [key: string]: unknown
}

type ClassroomRecord = {
  id: number
  title?: string
  code?: string
  term?: string
  class_status?: string
  instructor?: unknown
  [key: string]: unknown
}

type StrapiCollectionResponse<T> = {
  data: T[]
}

export default defineEventHandler(async (event): Promise<ClassroomRecord[]> => {
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

  const profileResponse = await $fetch<StrapiCollectionResponse<ProfileRecord>>(
    `${config.public.strapiUrl}/api/profiles?filters[auth_user_id][$eq]=${user.id}`,
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    }
  )

  const profile = profileResponse.data[0]

  if (!profile) {
    return []
  }

  const classroomResponse = await $fetch<StrapiCollectionResponse<ClassroomRecord>>(
    `${config.public.strapiUrl}/api/classrooms?filters[instructor][id][$eq]=${profile.id}&populate=*`,
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    }
  )

  return classroomResponse.data ?? []
})