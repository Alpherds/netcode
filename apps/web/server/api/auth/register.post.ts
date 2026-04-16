import { createError, readBody } from 'h3'

type RegisterBody = {
  display_name?: string
  username?: string
  email?: string
  password?: string
  confirmPassword?: string
  role_label?: string
}

type StrapiRegisterResponse = {
  jwt?: string
  user?: {
    id: number
    username: string
    email: string
    confirmed?: boolean
    blocked?: boolean
  }
}

type StrapiSingleResponse<T> = {
  data: T
}

type ProfileRecord = {
  id: number
  display_name?: string | null
  role_label?: string | null
  auth_user_id?: number | null
  is_active?: boolean | null
  [key: string]: unknown
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ALLOWED_ROLE_LABELS = ['STUDENT', 'INSTRUCTOR'] as const

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const body = await readBody<RegisterBody>(event)

  const displayName = String(body?.display_name || '').trim()
  const username = String(body?.username || '').trim()
  const email = String(body?.email || '').trim().toLowerCase()
  const password = String(body?.password || '')
  const confirmPassword = String(body?.confirmPassword || '')
  const roleLabel = String(body?.role_label || '').trim().toUpperCase()

  if (!displayName) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Display name is required',
    })
  }

  if (!username) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Username is required',
    })
  }

  if (!email) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Email is required',
    })
  }

  if (!EMAIL_REGEX.test(email)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A valid email is required',
    })
  }

  if (!password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Password is required',
    })
  }

  if (password.length < 6) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Password must be at least 6 characters',
    })
  }

  if (!confirmPassword) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Confirm password is required',
    })
  }

  if (password !== confirmPassword) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Passwords do not match',
    })
  }

  if (!ALLOWED_ROLE_LABELS.includes(roleLabel as (typeof ALLOWED_ROLE_LABELS)[number])) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Role must be STUDENT or INSTRUCTOR',
    })
  }

  const strapiUrl = String(config.public.strapiUrl || '').replace(/\/$/, '')
  const strapiApiToken = String(config.STRAPI_API_TOKEN || '').trim()

  if (!strapiUrl) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Strapi URL is missing',
    })
  }

  if (!strapiApiToken) {
    throw createError({
      statusCode: 500,
      statusMessage: 'STRAPI_API_TOKEN is missing',
    })
  }

  let registerResponse: StrapiRegisterResponse

  try {
    registerResponse = await $fetch<StrapiRegisterResponse>(
      `${strapiUrl}/api/auth/local/register`,
      {
        method: 'POST',
        body: {
          username,
          email,
          password,
        },
      }
    )
  } catch (error: any) {
    throw createError({
      statusCode: error?.statusCode || 400,
      statusMessage:
        error?.data?.error?.message ||
        error?.statusMessage ||
        'Failed to register account',
    })
  }

  const createdUser = registerResponse?.user

  if (!createdUser?.id) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Account was created but user payload is missing',
    })
  }

  try {
    await $fetch<StrapiSingleResponse<ProfileRecord>>(`${strapiUrl}/api/profiles`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${strapiApiToken}`,
      },
      body: {
        data: {
          display_name: displayName,
          role_label: roleLabel,
          auth_user_id: createdUser.id,
          is_active: true,
        },
      },
    })
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage:
        error?.data?.error?.message ||
        error?.statusMessage ||
        'Account created, but profile setup failed. Please contact the administrator.',
    })
  }

  return {
    ok: true,
    message: 'Account created successfully. Please check your email to confirm your account.',
    requires_email_confirmation: true,
    user: {
      id: createdUser.id,
      username: createdUser.username,
      email: createdUser.email,
      confirmed: createdUser.confirmed ?? false,
    },
    profile: {
      display_name: displayName,
      role_label: roleLabel,
    },
  }
})