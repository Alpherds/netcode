import { createError, getCookie, getRouterParam } from 'h3'

type StrapiCollectionResponse<T> = { data: T[] }
type StrapiSingleResponse<T> = { data: T }

type StrapiMe = {
  id: number
  username: string
}

type ProfileRecord = {
  id: number
  role_label?: string | null
  auth_user_id?: number | null
  [key: string]: unknown
}

type ClassroomRecord = {
  id: number
  [key: string]: unknown
}

type EnrollmentRecord = {
  id: number
  documentId?: string
  classroom?: ClassroomRecord | null
  [key: string]: unknown
}

export default defineEventHandler(async (event): Promise<EnrollmentRecord> => {
  const config = useRuntimeConfig(event)
  const jwt = getCookie(event, 'netcode_jwt')
  const enrollmentId = getRouterParam(event, 'id')

  if (!jwt) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  if (!enrollmentId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Enrollment id is required',
    })
  }

  const strapiUrl = String(config.public.strapiUrl || '').replace(/\/$/, '')
  const headers = {
    Authorization: `Bearer ${jwt}`,
  }

  const me = await $fetch<StrapiMe>(`${strapiUrl}/api/users/me`, { headers })

  const profileRes = await $fetch<StrapiCollectionResponse<ProfileRecord>>(
    `${strapiUrl}/api/profiles?filters[auth_user_id][$eq]=${me.id}`,
    { headers }
  )

  const profile = profileRes.data?.[0]

  if (!profile) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Profile not found',
    })
  }

  const role = String(profile.role_label || '').toUpperCase()

  if (role !== 'ADMIN' && role !== 'INSTRUCTOR') {
    throw createError({
      statusCode: 403,
      statusMessage: 'You do not have access to drop enrollments',
    })
  }

  const enrollmentRes = await $fetch<StrapiCollectionResponse<EnrollmentRecord>>(
    `${strapiUrl}/api/enrollments?filters[id][$eq]=${enrollmentId}&populate=classroom`,
    { headers }
  )

  const enrollment = enrollmentRes.data?.[0]
  const classroomId = enrollment?.classroom?.id

  if (!enrollment?.documentId || !classroomId) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Enrollment not found',
    })
  }

  if (role === 'INSTRUCTOR') {
    const classroomRes = await $fetch<StrapiCollectionResponse<ClassroomRecord>>(
      `${strapiUrl}/api/classrooms?filters[id][$eq]=${classroomId}&filters[instructor][id][$eq]=${profile.id}`,
      { headers }
    )

    if (!classroomRes.data?.[0]) {
      throw createError({
        statusCode: 403,
        statusMessage: 'You do not own this classroom',
      })
    }
  }

  const updated = await $fetch<StrapiSingleResponse<EnrollmentRecord>>(
    `${strapiUrl}/api/enrollments/${enrollment.documentId}`,
    {
      method: 'PUT',
      headers,
      body: {
        data: {
          enrollment_status: 'DROPPED',
        },
      },
    }
  )

  return updated.data
})