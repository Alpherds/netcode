import { createError, getCookie, getRouterParam } from 'h3'

type ProfileRecord = {
  id: number
  documentId?: string
  display_name?: string
  student_no?: string
  auth_user_id?: number
  [key: string]: unknown
}

type AttendanceRecord = {
  id: number
  documentId?: string
  join_time?: string | null
  leave_time?: string | null
  attendance_status?: string | null
  source?: string | null
  student?: ProfileRecord | null
  [key: string]: unknown
}

type StrapiCollectionResponse<T> = {
  data: T[]
}

export default defineEventHandler(async (event): Promise<AttendanceRecord[]> => {
  const config = useRuntimeConfig(event)
  const jwt = getCookie(event, 'netcode_jwt')
  const sessionId = getRouterParam(event, 'id')

  if (!jwt) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  if (!sessionId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Session id is required',
    })
  }

  const strapiUrl = String(config.public.strapiUrl || '').replace(/\/$/, '')
  const headers = {
    Authorization: `Bearer ${jwt}`,
  }

  const response = await $fetch<StrapiCollectionResponse<AttendanceRecord>>(
    `${strapiUrl}/api/attendances?filters[class_session][id][$eq]=${sessionId}&populate=student&sort[0]=join_time:asc`,
    { headers }
  )

  return response.data || []
})