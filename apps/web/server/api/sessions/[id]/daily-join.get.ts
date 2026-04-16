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
  display_name?: string | null
  role_label?: string | null
  auth_user_id?: number | null
  student_no?: string | null
  employee_no?: string | null
  [key: string]: unknown
}

type ClassroomRecord = {
  id: number
  title?: string | null
  code?: string | null
  term?: string | null
  documentId?: string
  [key: string]: unknown
}

type SessionRecord = {
  id: number
  title?: string | null
  room_name?: string | null
  meeting_status?: 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED' | string | null
  classroom?: ClassroomRecord | null
  [key: string]: unknown
}

type EnrollmentRecord = {
  id: number
  enrollment_status?: string | null
  [key: string]: unknown
}

type DailyRoomResponse = {
  id?: string
  name?: string
  url?: string
  api_created?: boolean
  privacy?: string
  [key: string]: unknown
}

type DailyTokenResponse = {
  token: string
}

type DailyJoinPayload = {
  roomUrl: string
  roomName: string
  token: string
  displayName: string
  isOwner: boolean
}

const DAILY_API_BASE = 'https://api.daily.co/v1'

const sanitizeRoomName = (value: string) => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

const readDailyError = async (response: Response) => {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export default defineEventHandler(async (event): Promise<DailyJoinPayload> => {
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

  const dailyApiKey = String(config.DAILY_API_KEY || '').trim()

  if (!dailyApiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Daily API key is missing',
    })
  }

  const strapiUrl = String(config.public.strapiUrl || '').replace(/\/$/, '')
  const strapiHeaders = {
    Authorization: `Bearer ${jwt}`,
  }

  const me = await $fetch<StrapiMe>(`${strapiUrl}/api/users/me`, {
    headers: strapiHeaders,
  })

  const profileResponse = await $fetch<StrapiCollectionResponse<ProfileRecord>>(
    `${strapiUrl}/api/profiles?filters[auth_user_id][$eq]=${me.id}`,
    { headers: strapiHeaders }
  )

  const profile = profileResponse.data?.[0]

  if (!profile) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Profile not found',
    })
  }

  const roleLabel = String(profile.role_label || '').toUpperCase()

  const sessionResponse = await $fetch<StrapiCollectionResponse<SessionRecord>>(
    `${strapiUrl}/api/class-sessions?filters[id][$eq]=${sessionId}&populate=classroom`,
    { headers: strapiHeaders }
  )

  const session = sessionResponse.data?.[0]

  if (!session) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Session not found',
    })
  }

  if (!session.classroom?.id) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Classroom not found for this session',
    })
  }

  if (roleLabel === 'INSTRUCTOR' || roleLabel === 'ADMIN') {
    const classroomUrl =
      roleLabel === 'INSTRUCTOR'
        ? `${strapiUrl}/api/classrooms?filters[id][$eq]=${session.classroom.id}&filters[instructor][id][$eq]=${profile.id}`
        : `${strapiUrl}/api/classrooms?filters[id][$eq]=${session.classroom.id}`

    const classroomAccess = await $fetch<StrapiCollectionResponse<ClassroomRecord>>(
      classroomUrl,
      { headers: strapiHeaders }
    )

    if (!classroomAccess.data?.length) {
      throw createError({
        statusCode: 403,
        statusMessage: 'You do not have access to this classroom session',
      })
    }
  } else if (roleLabel === 'STUDENT') {
    const enrollmentAccess = await $fetch<StrapiCollectionResponse<EnrollmentRecord>>(
      `${strapiUrl}/api/enrollments?filters[classroom][id][$eq]=${session.classroom.id}&filters[student][id][$eq]=${profile.id}&filters[enrollment_status][$eq]=ACTIVE`,
      { headers: strapiHeaders }
    )

    if (!enrollmentAccess.data?.length) {
      throw createError({
        statusCode: 403,
        statusMessage: 'You are not enrolled in this classroom',
      })
    }
  } else {
    throw createError({
      statusCode: 403,
      statusMessage: 'You do not have access to this session',
    })
  }

  const rawRoomName =
    session.room_name ||
    `session-${session.id}-${session.classroom.code || session.classroom.id}`

  const roomName = sanitizeRoomName(rawRoomName)

  if (!roomName) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid room name',
    })
  }

  const dailyHeaders = {
    Authorization: `Bearer ${dailyApiKey}`,
    'Content-Type': 'application/json',
  }

  let roomUrl = ''

  const existingRoomResponse = await fetch(
    `${DAILY_API_BASE}/rooms/${encodeURIComponent(roomName)}`,
    {
      method: 'GET',
      headers: dailyHeaders,
    }
  )

  if (existingRoomResponse.ok) {
    const existingRoom = (await existingRoomResponse.json()) as DailyRoomResponse
    roomUrl = String(existingRoom.url || '').trim()
  } else if (existingRoomResponse.status === 404) {
    const createRoomResponse = await fetch(`${DAILY_API_BASE}/rooms`, {
      method: 'POST',
      headers: dailyHeaders,
      body: JSON.stringify({
        name: roomName,
        privacy: 'private',
        properties: {
          enable_prejoin_ui: false,
          start_audio_off: true,
          start_video_off: true,
        },
      }),
    })

    if (!createRoomResponse.ok) {
      const dailyError = await readDailyError(createRoomResponse)
      console.error('Daily create room failed:', dailyError)

      throw createError({
        statusCode: 500,
        statusMessage:
          dailyError?.info ||
          dailyError?.error ||
          'Failed to create Daily room',
      })
    }

    const createdRoom = (await createRoomResponse.json()) as DailyRoomResponse
    roomUrl = String(createdRoom.url || '').trim()
  } else {
    const dailyError = await readDailyError(existingRoomResponse)
    console.error('Daily get room failed:', dailyError)

    throw createError({
      statusCode: 500,
      statusMessage:
        dailyError?.info ||
        dailyError?.error ||
        'Failed to fetch Daily room',
    })
  }

  if (!roomUrl) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Daily room URL is missing',
    })
  }

  const displayName =
    String(profile.display_name || '').trim() ||
    String(me.username || '').trim() ||
    'Participant'

  const isOwner = roleLabel === 'INSTRUCTOR' || roleLabel === 'ADMIN'
  const nowSeconds = Math.floor(Date.now() / 1000)
  const expSeconds = nowSeconds + 60 * 60 * 6

  const tokenResponse = await fetch(`${DAILY_API_BASE}/meeting-tokens`, {
    method: 'POST',
    headers: dailyHeaders,
    body: JSON.stringify({
      properties: {
        room_name: roomName,
        user_name: displayName,
        is_owner: isOwner,
        exp: expSeconds,
      },
    }),
  })

  if (!tokenResponse.ok) {
    const dailyError = await readDailyError(tokenResponse)
    console.error('Daily meeting token failed:', dailyError)

    throw createError({
      statusCode: 500,
      statusMessage:
        dailyError?.info ||
        dailyError?.error ||
        'Failed to create Daily meeting token',
    })
  }

  const tokenData = (await tokenResponse.json()) as DailyTokenResponse

  if (!tokenData?.token) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Daily meeting token is missing',
    })
  }

  return {
    roomUrl,
    roomName,
    token: tokenData.token,
    displayName,
    isOwner,
  }
})