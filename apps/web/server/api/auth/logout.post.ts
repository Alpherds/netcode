import { setCookie } from 'h3'

export default defineEventHandler(async (event) => {
  setCookie(event, 'netcode_jwt', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })

  setCookie(event, 'netcode_user', '', {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })

  return { ok: true }
})