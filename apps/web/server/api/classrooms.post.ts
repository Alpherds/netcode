import { createError, getCookie, readBody } from 'h3'

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
  role_label?: string | null
  auth_user_id?: number | null
  [key: string]: unknown
}

type ClassroomBody = {
  title?: string
  code?: string
  description?: string
  term?: string
  class_status?: 'OPEN' | 'CLOSED' | 'ARCHIVED'
}

type ClassroomRecord = {
  id: number
  documentId?: string
  title?: string | null
  code?: string | null
  description?: string | null
  term?: string | null
  class_status?: string | null
  [key: string]: unknown
}

export default defineEventHandler(async (event): Promise<ClassroomRecord> => {
  const config = useRuntimeConfig(event)
  const jwt = getCookie(event, 'netcode_jwt')
  const body = await readBody<ClassroomBody>(event)

  if (!jwt) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const title = String(body?.title || '').trim()
  const code = String(body?.code || '').trim()
  const description = String(body?.description || '').trim()
  const term = String(body?.term || '').trim()
  const classStatus = body?.class_status || 'OPEN'

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

  const allowedStatuses = ['OPEN', 'CLOSED', 'ARCHIVED']
  if (!allowedStatuses.includes(classStatus)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid classroom status',
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
      statusMessage: 'You do not have permission to create a classroom',
    })
  }

  const duplicateResponse = await $fetch<StrapiCollectionResponse<ClassroomRecord>>(
    `${strapiUrl}/api/classrooms?filters[code][$eq]=${encodeURIComponent(code)}`,
    { headers }
  )

  if (duplicateResponse.data?.length) {
    throw createError({
      statusCode: 409,
      statusMessage: 'A classroom with this code already exists',
    })
  }

  const created = await $fetch<StrapiSingleResponse<ClassroomRecord>>(
    `${strapiUrl}/api/classrooms`,
    {
      method: 'POST',
      headers,
      body: {
        data: {
          title,
          code,
          description,
          term,
          class_status: classStatus,
          instructor: profile.id,
        },
      },
    }
  )

  return created.data
})