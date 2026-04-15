import { createError, getCookie, getRouterParam } from 'h3'

type StrapiCollectionResponse<T> = {
  data: T[]
}

type StrapiMe = {
  id: number
  username: string
  email?: string
}

type ProfileRecord = {
  id: number
  documentId?: string
  display_name?: string | null
  role_label?: string | null
  auth_user_id?: number | null
  [key: string]: unknown
}

type ClassroomRecord = {
  id: number
  documentId?: string
  title?: string | null
  code?: string | null
  description?: string | null
  term?: string | null
  class_status?: string | null
  instructor?: ProfileRecord | null
  [key: string]: unknown
}

type EnrollmentRecord = {
  id: number
  documentId?: string
  enrollment_status?: string | null
  classroom?: ClassroomRecord | null
  student?: ProfileRecord | null
  [key: string]: unknown
}

export default defineEventHandler(async (event): Promise<ClassroomRecord> => {
  const config = useRuntimeConfig(event)
  const jwt = getCookie(event, 'netcode_jwt')
  const classroomId = getRouterParam(event, 'id')

  if (!jwt) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  if (!classroomId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Classroom id is required',
    })
  }

  const strapiUrl = String(config.public.strapiUrl || '').replace(/\/$/, '')
  const headers = {
    Authorization: `Bearer ${jwt}`,
  }

  const me = await $fetch<StrapiMe>(`${strapiUrl}/api/users/me`, {
    headers,
  })

  const profileResponse = await $fetch<StrapiCollectionResponse<ProfileRecord>>(
    `${strapiUrl}/api/profiles?filters[auth_user_id][$eq]=${me.id}`,
    { headers }
  )

  const profile = profileResponse.data?.[0]

  if (!profile) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Profile not found',
    })
  }

  const roleLabel = String(profile.role_label || '').toUpperCase()

  if (roleLabel === 'INSTRUCTOR' || roleLabel === 'ADMIN') {
    const classroomResponse = await $fetch<StrapiCollectionResponse<ClassroomRecord>>(
      `${strapiUrl}/api/classrooms?filters[id][$eq]=${classroomId}&filters[instructor][id][$eq]=${profile.id}&populate=instructor`,
      { headers }
    )

    const classroom = classroomResponse.data?.[0]

    if (!classroom) {
      throw createError({
        statusCode: 403,
        statusMessage: 'You do not have access to this classroom',
      })
    }

    return classroom
  }

  if (roleLabel === 'STUDENT') {
    const enrollmentResponse = await $fetch<StrapiCollectionResponse<EnrollmentRecord>>(
      `${strapiUrl}/api/enrollments?filters[student][id][$eq]=${profile.id}&filters[classroom][id][$eq]=${classroomId}&filters[enrollment_status][$eq]=ACTIVE&populate[0]=classroom&populate[1]=classroom.instructor`,
      { headers }
    )

    const enrollment = enrollmentResponse.data?.[0]
    const classroom = enrollment?.classroom

    if (!classroom) {
      throw createError({
        statusCode: 403,
        statusMessage: 'You are not enrolled in this classroom',
      })
    }

    return classroom
  }

  throw createError({
    statusCode: 403,
    statusMessage: 'You do not have access to this classroom',
  })
})