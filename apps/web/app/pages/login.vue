<script setup lang="ts">
import { navigateTo } from '#imports'
import { useAuth } from '~/composables/useAuth'

const identifier = ref('')
const password = ref('')
const errorMessage = ref('')

const { login, user } = useAuth()

watch(
  () => user.value,
  async (val) => {
    if (val) {
      await navigateTo('/')
    }
  },
  { immediate: true }
)

const submit = async () => {
  errorMessage.value = ''

  try {
    await login(identifier.value, password.value)
    await navigateTo('/')
  } catch (error: any) {
    errorMessage.value =
      error?.data?.message ||
      error?.statusMessage ||
      'Login failed'
  }
}
</script>

<template>
  <div style="max-width: 420px; margin: 60px auto;">
    <h1>Login</h1>

    <div style="display: grid; gap: 12px;">
      <input
        v-model="identifier"
        type="text"
        placeholder="Email or username"
      />

      <input
        v-model="password"
        type="password"
        placeholder="Password"
      />

      <button @click="submit">Login</button>

      <p v-if="errorMessage" style="color: red;">
        {{ errorMessage }}
      </p>
    </div>
  </div>
</template>