import { createError, getCookie, getQuery } from 'h3'

type StrapiCollectionResponse<T> = { data: T[] }

type StrapiMe = {
  id: number
  username: string
}

type ProfileRecord = {
  id: number
  role_label?: string | null
  auth_user_id?: number | null
  display_name?: string | null
  student_no?: string | null
  program?: string | null
  year_level?: string | null
  section?: string | null
  [key: string]: unknown
}

type ClassroomRecord = {
  id: number
  [key: string]: unknown
}

type EnrollmentRecord = {
  id: number
  student?: ProfileRecord | null
  [key: string]: unknown
}

export default defineEventHandler(async (event): Promise<ProfileRecord[]> => {
  const config = useRuntimeConfig(event)
  const jwt = getCookie(event, 'netcode_jwt')
  const query = getQuery(event)

  const q = String(query.q || '').trim()
  const classroomId = String(query.classroomId || '').trim()

  if (!jwt) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  if (!classroomId) throw createError({ statusCode: 400, statusMessage: 'Classroom id is required' })

  const strapiUrl = String(config.public.strapiUrl || '').replace(/\/$/, '')
  const headers = { Authorization: `Bearer ${jwt}` }

  const me = await $fetch<StrapiMe>(`${strapiUrl}/api/users/me`, { headers })

  const profileRes = await $fetch<StrapiCollectionResponse<ProfileRecord>>(
    `${strapiUrl}/api/profiles?filters[auth_user_id][$eq]=${me.id}`,
    { headers }
  )

  const profile = profileRes.data?.[0]
  if (!profile) throw createError({ statusCode: 404, statusMessage: 'Profile not found' })

  const role = String(profile.role_label || '').toUpperCase()
  if (role !== 'ADMIN' && role !== 'INSTRUCTOR') {
    throw createError({ statusCode: 403, statusMessage: 'You do not have access to student search' })
  }

  if (role === 'INSTRUCTOR') {
    const classroomRes = await $fetch<StrapiCollectionResponse<ClassroomRecord>>(
      `${strapiUrl}/api/classrooms?filters[id][$eq]=${classroomId}&filters[instructor][id][$eq]=${profile.id}`,
      { headers }
    )

    if (!classroomRes.data?.[0]) {
      throw createError({ statusCode: 403, statusMessage: 'You do not own this classroom' })
    }
  }

  const searchUrl = q
    ? `${strapiUrl}/api/profiles?filters[role_label][$eq]=STUDENT&filters[display_name][$containsi]=${encodeURIComponent(q)}&sort[0]=display_name:asc&pagination[limit]=20`
    : `${strapiUrl}/api/profiles?filters[role_label][$eq]=STUDENT&sort[0]=display_name:asc&pagination[limit]=20`

  const studentsRes = await $fetch<StrapiCollectionResponse<ProfileRecord>>(searchUrl, {
    headers,
  })

  const activeEnrollmentsRes = await $fetch<StrapiCollectionResponse<EnrollmentRecord>>(
    `${strapiUrl}/api/enrollments?filters[classroom][id][$eq]=${classroomId}&filters[enrollment_status][$eq]=ACTIVE&populate=student`,
    { headers }
  )

  const enrolledIds = new Set(
    (activeEnrollmentsRes.data || [])
      .map((item) => item.student?.id)
      .filter((id): id is number => Boolean(id))
  )

  return (studentsRes.data || []).filter((student) => !enrolledIds.has(student.id))
})