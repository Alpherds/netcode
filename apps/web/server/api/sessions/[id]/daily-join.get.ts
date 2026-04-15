import { createError, getCookie, getRouterParam } from 'h3'

type SessionStatus = 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED'

type SessionRecord = {
  id: number
  documentId?: string
  title?: string
  meeting_status?: SessionStatus
  room_name?: string
  classroom?: {
    id?: number
    title?: string
    code?: string
    term?: string
    [key: string]: unknown
  } | null
  [key: string]: unknown
}

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
  const strapiHeaders = {
    Authorization: `Bearer ${jwt}`,
  }

  const sessionResponse = await $fetch<StrapiCollectionResponse<SessionRecord>>(
    `${strapiUrl}/api/class-sessions?filters[id][$eq]=${sessionId}&populate=classroom`,
    {
      headers: strapiHeaders,
    }
  )

  const session = sessionResponse.data?.[0]

  if (!session) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Session not found',
    })
  }

  if (session.meeting_status !== 'LIVE') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Session is not live',
    })
  }

  const me = await $fetch<StrapiMe>(`${strapiUrl}/api/users/me`, {
    headers: strapiHeaders,
  })

  let profile: ProfileRecord | null = null

  try {
    const profileResponse = await $fetch<StrapiCollectionResponse<ProfileRecord>>(
      `${strapiUrl}/api/profiles?filters[auth_user_id][$eq]=${me.id}`,
      {
        headers: strapiHeaders,
      }
    )

    profile = profileResponse.data?.[0] || null
  } catch {
    profile = null
  }

  const displayName =
    profile?.display_name?.trim() || me.username || `user-${me.id}`

  const roleLabel = String(profile?.role_label || '').toUpperCase()
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