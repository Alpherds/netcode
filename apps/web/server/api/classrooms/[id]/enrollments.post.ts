import { createError, getCookie, getRouterParam, readBody } from 'h3'

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
  documentId?: string
  class_status?: 'OPEN' | 'CLOSED' | 'ARCHIVED' | string | null
  [key: string]: unknown
}

type EnrollmentRecord = {
  id: number
  documentId?: string
  enrollment_status?: string | null
  [key: string]: unknown
}

type Body = {
  studentId?: number
}

export default defineEventHandler(async (event): Promise<EnrollmentRecord> => {
  const config = useRuntimeConfig(event)
  const jwt = getCookie(event, 'netcode_jwt')
  const classroomId = getRouterParam(event, 'id')
  const body = await readBody<Body>(event)

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

  if (!body?.studentId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Student id is required',
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
      statusMessage: 'You do not have access to enroll students',
    })
  }

  const classroomLookupUrl =
    role === 'INSTRUCTOR'
      ? `${strapiUrl}/api/classrooms?filters[id][$eq]=${classroomId}&filters[instructor][id][$eq]=${profile.id}`
      : `${strapiUrl}/api/classrooms?filters[id][$eq]=${classroomId}`

  const classroomRes = await $fetch<StrapiCollectionResponse<ClassroomRecord>>(
    classroomLookupUrl,
    { headers }
  )

  const classroom = classroomRes.data?.[0]

  if (!classroom) {
    throw createError({
      statusCode: role === 'INSTRUCTOR' ? 403 : 404,
      statusMessage:
        role === 'INSTRUCTOR'
          ? 'You do not own this classroom'
          : 'Classroom not found',
    })
  }

  if (String(classroom.class_status || '').toUpperCase() === 'ARCHIVED') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Enrollment changes are disabled for archived classrooms',
    })
  }

  const existingRes = await $fetch<StrapiCollectionResponse<EnrollmentRecord>>(
    `${strapiUrl}/api/enrollments?filters[classroom][id][$eq]=${classroomId}&filters[student][id][$eq]=${body.studentId}`,
    { headers }
  )

  const existing = existingRes.data?.[0]

  if (existing?.documentId) {
    const updated = await $fetch<StrapiSingleResponse<EnrollmentRecord>>(
      `${strapiUrl}/api/enrollments/${existing.documentId}`,
      {
        method: 'PUT',
        headers,
        body: {
          data: {
            enrollment_status: 'ACTIVE',
          },
        },
      }
    )

    return updated.data
  }

  const created = await $fetch<StrapiSingleResponse<EnrollmentRecord>>(
    `${strapiUrl}/api/enrollments`,
    {
      method: 'POST',
      headers,
      body: {
        data: {
          enrollment_status: 'ACTIVE',
          classroom: Number(classroomId),
          student: body.studentId,
        },
      },
    }
  )

  return created.data
})