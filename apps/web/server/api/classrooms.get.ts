import { createError, getCookie } from 'h3'

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
  display_name?: string
  role_label?: string
  auth_user_id?: number
  [key: string]: unknown
}

type ClassroomRecord = {
  id: number
  documentId?: string
  title?: string
  code?: string
  description?: string
  term?: string
  class_status?: string
  instructor?: ProfileRecord | null
  [key: string]: unknown
}

type EnrollmentRecord = {
  id: number
  documentId?: string
  enrollment_status?: string
  classroom?: ClassroomRecord | null
  student?: ProfileRecord | null
  [key: string]: unknown
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

  const strapiUrl = String(config.public.strapiUrl || '').replace(/\/$/, '')
  const headers = {
    Authorization: `Bearer ${jwt}`,
  }

  const me = await $fetch<StrapiMe>(`${strapiUrl}/api/users/me`, {
    headers,
  })

  const profileResponse = await $fetch<StrapiCollectionResponse<ProfileRecord>>(
    `${strapiUrl}/api/profiles?filters[auth_user_id][$eq]=${me.id}`,
    {
      headers,
    }
  )

  const profile = profileResponse.data?.[0]

  if (!profile) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Profile not found',
    })
  }

  const roleLabel = String(profile.role_label || '').toUpperCase()

  // INSTRUCTOR / ADMIN → own classrooms
  if (roleLabel === 'INSTRUCTOR' || roleLabel === 'ADMIN') {
    const classroomResponse = await $fetch<StrapiCollectionResponse<ClassroomRecord>>(
      `${strapiUrl}/api/classrooms?filters[instructor][id][$eq]=${profile.id}&sort[0]=title:asc`,
      {
        headers,
      }
    )

    return classroomResponse.data || []
  }

  // STUDENT → enrolled classrooms only
  if (roleLabel === 'STUDENT') {
    const enrollmentResponse = await $fetch<StrapiCollectionResponse<EnrollmentRecord>>(
      `${strapiUrl}/api/enrollments?filters[student][id][$eq]=${profile.id}&filters[enrollment_status][$eq]=ACTIVE&populate=classroom&sort[0]=id:asc`,
      {
        headers,
      }
    )

    return (enrollmentResponse.data || [])
      .map((item) => item.classroom)
      .filter((item): item is ClassroomRecord => Boolean(item))
  }

  return []
})