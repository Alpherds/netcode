<script setup lang="ts">
import { definePageMeta, navigateTo, useFetch } from '#imports'
import { useAuth } from '~/composables/useAuth'

definePageMeta({
  middleware: 'auth',
})

const { user, logout } = useAuth()

const { data: profile } = await useFetch('/api/profile')
const { data: classrooms } = await useFetch('/api/classrooms')

const doLogout = async () => {
  await logout()
  await navigateTo('/login')
}
</script>

<template>
  <div style="padding: 24px;">
    <h1>Netcode Dashboard</h1>

    <p v-if="user">
      Logged in as: {{ user.email }}
    </p>

    <button @click="doLogout">Logout</button>

    <hr style="margin: 24px 0;" />

    <h2>Profile</h2>
    <pre>{{ profile }}</pre>

    <h2>Classrooms</h2>
    <pre>{{ classrooms }}</pre>
  </div>
</template>