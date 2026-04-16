type SessionUser = {
  id: number
  username: string
  email: string
}

type RegisterRole = 'STUDENT' | 'INSTRUCTOR'

type RegisterPayload = {
  display_name: string
  username: string
  email: string
  password: string
  confirmPassword: string
  role_label: RegisterRole
}

type RegisterResponse = {
  ok: boolean
  message: string
  requires_email_confirmation: boolean
  user: {
    id: number
    username: string
    email: string
    confirmed?: boolean
  }
  profile: {
    display_name: string
    role_label: RegisterRole
  }
}

export const useAuth = () => {
  const user = useState<SessionUser | null>('auth.user', () => null)
  const loggedIn = computed(() => !!user.value)

  const restore = async () => {
    try {
      user.value = await $fetch<SessionUser | null>('/api/auth/session')
    } catch {
      user.value = null
    }
  }

  const login = async (identifier: string, password: string) => {
    const response = await $fetch<{ user: SessionUser }>('/api/auth/login', {
      method: 'POST',
      body: { identifier, password },
    })

    user.value = response.user
    return response
  }

  const register = async (payload: RegisterPayload) => {
    const response = await $fetch<RegisterResponse>('/api/auth/register', {
      method: 'POST',
      body: payload,
    })

    return response
  }

  const logout = async () => {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
  }

  return {
    user,
    loggedIn,
    restore,
    login,
    register,
    logout,
  }
}