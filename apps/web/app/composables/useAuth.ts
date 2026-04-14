type SessionUser = {
  id: number
  username: string
  email: string
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
    logout,
  }
}