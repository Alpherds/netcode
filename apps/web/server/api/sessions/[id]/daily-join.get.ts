import { createError, getCookie, getRouterParam } from 'h3'

type SessionStatus = 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED'

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

type ClassroomRef = {
  id?: number
  documentId?: string
  title?: string | null
  code?: string | null
  term?: string | null
  [key: string]: unknown
}

type SessionRecord = {
  id: number
  documentId?: string
  title?: string | null
  meeting_status?: SessionStatus | null
  room_name?: string | null
  classroom?: ClassroomRef | null
  [key: string]: unknown
}

type ClassroomRecord = {
  id: number
  documentId?: string
  [key: string]: unknown
}

type EnrollmentRecord = {
  id: number
  documentId?: string
  enrollment_status?: string | null
  [key: string]: unknown
}

type DailyRoom = {
  id?: string
  name: string
  url: string
  [key: string]: unknown
}

type DailyTokenResponse = {
  token: string
}

type DailyJoinResponse = {
  roomUrl: string
  roomName: string
  token: string
  displayName: string
  isOwner: boolean
}

const DAILY_API_BASE = 'https://api.daily.co/v1'

export default defineEventHandler(async (event): Promise<DailyJoinResponse> => {
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

  if (!config.DAILY_API_KEY) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Daily API key is missing',
    })
  }

  const strapiUrl = String(config.public.strapiUrl || '').replace(/\/$/, '')
  const roomPrefix = String(config.DAILY_ROOM_PREFIX || 'netcode-session-')
  const roomName = `${roomPrefix}${sessionId}`.toLowerCase()
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

  const sessionResponse = await $fetch<StrapiCollectionResponse<SessionRecord>>(
    `${strapiUrl}/api/class-sessions?filters[id][$eq]=${sessionId}&populate=classroom`,
    { headers }
  )

  const session = sessionResponse.data?.[0]

  if (!session) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Session not found',
    })
  }

  const classroomId = session.classroom?.id

  if (!classroomId) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Session classroom not found',
    })
  }

  const roleLabel = String(profile.role_label || '').toUpperCase()

  if (roleLabel === 'INSTRUCTOR') {
    const classroomResponse = await $fetch<StrapiCollectionResponse<ClassroomRecord>>(
      `${strapiUrl}/api/classrooms?filters[id][$eq]=${classroomId}&filters[instructor][id][$eq]=${profile.id}`,
      { headers }
    )

    if (!classroomResponse.data?.[0]) {
      throw createError({
        statusCode: 403,
        statusMessage: 'You do not have access to this session',
      })
    }
  } else if (roleLabel === 'STUDENT') {
    const enrollmentResponse = await $fetch<StrapiCollectionResponse<EnrollmentRecord>>(
      `${strapiUrl}/api/enrollments?filters[student][id][$eq]=${profile.id}&filters[classroom][id][$eq]=${classroomId}&filters[enrollment_status][$eq]=ACTIVE`,
      { headers }
    )

    if (!enrollmentResponse.data?.[0]) {
      throw createError({
        statusCode: 403,
        statusMessage: 'You are not enrolled in this session classroom',
      })
    }
  } else if (roleLabel !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      statusMessage: 'You do not have access to this session',
    })
  }

  if (session.meeting_status !== 'LIVE') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Session is not live',
    })
  }

  const displayName =
    profile.display_name?.trim() || me.username || `user-${me.id}`

  const isOwner = roleLabel === 'INSTRUCTOR' || roleLabel === 'ADMIN'

  const dailyHeaders = {
    Authorization: `Bearer ${config.DAILY_API_KEY}`,
    'Content-Type': 'application/json',
  }

  let room: DailyRoom | null = null

  try {
    room = await $fetch<DailyRoom>(`${DAILY_API_BASE}/rooms/${roomName}`, {
      headers: dailyHeaders,
    })
  } catch (error: any) {
    if (error?.statusCode !== 404) {
      throw createError({
        statusCode: error?.statusCode || 500,
        statusMessage:
          error?.data?.info ||
          error?.data?.error ||
          error?.statusMessage ||
          'Failed to fetch Daily room',
      })
    }
  }

  if (!room) {
    room = await $fetch<DailyRoom>(`${DAILY_API_BASE}/rooms`, {
      method: 'POST',
      headers: dailyHeaders,
      body: {
        name: roomName,
        privacy: 'private',
        properties: {
          enable_prejoin_ui: false,
          start_audio_off: true,
          start_video_off: true,
          exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
        },
      },
    })
  }

  const now = Math.floor(Date.now() / 1000)
  const exp = now + 60 * 60 * 4

  const tokenResponse = await $fetch<DailyTokenResponse>(
    `${DAILY_API_BASE}/meeting-tokens`,
    {
      method: 'POST',
      headers: dailyHeaders,
      body: {
        properties: {
          room_name: roomName,
          exp,
          is_owner: isOwner,
          user_name: displayName,
          user_id: String(me.id).slice(0, 36),
          enable_prejoin_ui: false,
          start_audio_off: true,
          start_video_off: true,
        },
      },
    }
  )

  return {
    roomUrl: room.url,
    roomName,
    token: tokenResponse.token,
    displayName,
    isOwner,
  }
})