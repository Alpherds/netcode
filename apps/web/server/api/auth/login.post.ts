import { createError, readBody, setCookie } from 'h3'

type LoginBody = {
  identifier: string
  password: string
}

type StrapiLoginResponse = {
  jwt: string
  user: {
    id: number
    username: string
    email: string
  }
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const body = await readBody<LoginBody>(event)

  const identifier = String(body?.identifier || '').trim()
  const password = String(body?.password || '')

  if (!identifier || !password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Email/username and password are required.',
    })
  }

  try {
    const response = await $fetch<StrapiLoginResponse>(
      `${config.public.strapiUrl}/api/auth/local`,
      {
        method: 'POST',
        body: {
          identifier,
          password,
        },
      }
    )

    setCookie(event, 'netcode_jwt', response.jwt, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
    })

    setCookie(
      event,
      'netcode_user',
      encodeURIComponent(
        JSON.stringify({
          id: response.user.id,
          username: response.user.username,
          email: response.user.email,
        })
      ),
      {
        httpOnly: false,
        sameSite: 'lax',
        secure: false,
        path: '/',
      }
    )

    return {
      user: response.user,
    }
  } catch (error: any) {
    const rawMessage =
      error?.data?.error?.message ||
      error?.statusMessage ||
      'Invalid email/username or password'

    const normalized = String(rawMessage).toLowerCase()

    if (
      normalized.includes('confirmed') ||
      normalized.includes('confirmation')
    ) {
      throw createError({
        statusCode: 403,
        statusMessage:
          'Your email is not yet confirmed. Please check your inbox and confirm your account before signing in.',
      })
    }

    if (normalized.includes('blocked')) {
      throw createError({
        statusCode: 403,
        statusMessage:
          'Your account is blocked. Please contact the administrator.',
      })
    }

    throw createError({
      statusCode: error?.statusCode || 401,
      statusMessage: 'Invalid email/username or password.',
    })
  }
})