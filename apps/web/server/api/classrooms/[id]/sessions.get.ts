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

type SessionRecord = {
  id: number
  documentId?: string
  title?: string | null
  starts_at?: string | null
  ends_at?: string | null
  room_name?: string | null
  meeting_provider?: string | null
  meeting_status?: string | null
  notes?: string | null
  classroom?: ClassroomRecord | null
  [key: string]: unknown
}

export default defineEventHandler(async (event): Promise<SessionRecord[]> => {
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

  let allowed = false

  if (roleLabel === 'INSTRUCTOR' || roleLabel === 'ADMIN') {
    const classroomResponse = await $fetch<StrapiCollectionResponse<ClassroomRecord>>(
      `${strapiUrl}/api/classrooms?filters[id][$eq]=${classroomId}&filters[instructor][id][$eq]=${profile.id}`,
      { headers }
    )

    allowed = Boolean(classroomResponse.data?.[0])
  } else if (roleLabel === 'STUDENT') {
    const enrollmentResponse = await $fetch<StrapiCollectionResponse<EnrollmentRecord>>(
      `${strapiUrl}/api/enrollments?filters[student][id][$eq]=${profile.id}&filters[classroom][id][$eq]=${classroomId}&filters[enrollment_status][$eq]=ACTIVE`,
      { headers }
    )

    allowed = Boolean(enrollmentResponse.data?.[0])
  }

  if (!allowed) {
    throw createError({
      statusCode: 403,
      statusMessage: 'You do not have access to this classroom sessions list',
    })
  }

  const sessionsResponse = await $fetch<StrapiCollectionResponse<SessionRecord>>(
    `${strapiUrl}/api/class-sessions?filters[classroom][id][$eq]=${classroomId}&populate=classroom&sort[0]=starts_at:asc`,
    { headers }
  )

  return sessionsResponse.data || []
})