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

  if (!body?.identifier || !body?.password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Identifier and password are required',
    })
  }

  try {
    const response = await $fetch<StrapiLoginResponse>(
      `${config.public.strapiUrl}/api/auth/local`,
      {
        method: 'POST',
        body,
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
    throw createError({
      statusCode: error?.statusCode || 401,
      statusMessage:
        error?.data?.error?.message || 'Invalid email/username or password',
    })
  }
})