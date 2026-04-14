export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/login') return

  const { user, restore } = useAuth()

  if (!user.value) {
    await restore()
  }

  if (!user.value) {
    return navigateTo('/login')
  }
})