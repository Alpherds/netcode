import { createError, getCookie, getRouterParam, readBody } from 'h3'

type StrapiCollectionResponse<T> = {
  data: T[]
}

type StrapiSingleResponse<T> = {
  data: T
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

type ClassroomBody = {
  title?: string
  code?: string
  description?: string
  term?: string
}

type ClassroomRecord = {
  id: number
  documentId?: string
  title?: string | null
  code?: string | null
  description?: string | null
  term?: string | null
  class_status?: 'OPEN' | 'CLOSED' | 'ARCHIVED' | string | null
  instructor?: ProfileRecord | null
  [key: string]: unknown
}

export default defineEventHandler(async (event): Promise<ClassroomRecord> => {
  const config = useRuntimeConfig(event)
  const jwt = getCookie(event, 'netcode_jwt')
  const classroomId = getRouterParam(event, 'id')
  const body = await readBody<ClassroomBody>(event)

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

  const title = String(body?.title || '').trim()
  const code = String(body?.code || '').trim()
  const description = String(body?.description || '').trim()
  const term = String(body?.term || '').trim()

  if (!title) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Classroom title is required',
    })
  }

  if (!code) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Classroom code is required',
    })
  }

  if (!term) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Term is required',
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

  if (roleLabel !== 'INSTRUCTOR' && roleLabel !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      statusMessage: 'You do not have permission to edit this classroom',
    })
  }

  const classroomLookupUrl =
    roleLabel === 'INSTRUCTOR'
      ? `${strapiUrl}/api/classrooms?filters[id][$eq]=${classroomId}&filters[instructor][id][$eq]=${profile.id}&populate=instructor`
      : `${strapiUrl}/api/classrooms?filters[id][$eq]=${classroomId}&populate=instructor`

  const classroomResponse = await $fetch<StrapiCollectionResponse<ClassroomRecord>>(
    classroomLookupUrl,
    { headers }
  )

  const classroom = classroomResponse.data?.[0]

  if (!classroom?.documentId) {
    throw createError({
      statusCode: roleLabel === 'INSTRUCTOR' ? 403 : 404,
      statusMessage:
        roleLabel === 'INSTRUCTOR'
          ? 'You do not own this classroom'
          : 'Classroom not found',
    })
  }

  if (String(classroom.class_status || '').toUpperCase() === 'ARCHIVED') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Archived classrooms can no longer be edited',
    })
  }

  const duplicateResponse = await $fetch<StrapiCollectionResponse<ClassroomRecord>>(
    `${strapiUrl}/api/classrooms?filters[code][$eq]=${encodeURIComponent(code)}`,
    { headers }
  )

  const conflicting = (duplicateResponse.data || []).find(
    (item) => String(item.id) !== String(classroomId)
  )

  if (conflicting) {
    throw createError({
      statusCode: 409,
      statusMessage: 'A classroom with this code already exists',
    })
  }

  await $fetch<StrapiSingleResponse<ClassroomRecord>>(
    `${strapiUrl}/api/classrooms/${classroom.documentId}`,
    {
      method: 'PUT',
      headers,
      body: {
        data: {
          title,
          code,
          description,
          term,
        },
      },
    }
  )

  const refreshedResponse = await $fetch<StrapiCollectionResponse<ClassroomRecord>>(
    `${strapiUrl}/api/classrooms?filters[id][$eq]=${classroomId}&populate=instructor`,
    { headers }
  )

  const updatedClassroom = refreshedResponse.data?.[0]

  if (!updatedClassroom) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Updated classroom not found',
    })
  }

  return updatedClassroom
})