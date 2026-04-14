import { getCookie } from 'h3'

export default defineEventHandler((event) => {
  const rawUser = getCookie(event, 'netcode_user')

  if (!rawUser) {
    return null
  }

  try {
    return JSON.parse(decodeURIComponent(rawUser))
  } catch {
    return null
  }
})