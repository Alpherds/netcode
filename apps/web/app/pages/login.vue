<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { navigateTo, useRoute } from '#imports'
import { useAuth } from '~/composables/useAuth'

type RegisterRole = 'STUDENT' | 'INSTRUCTOR'
type AuthTab = 'signin' | 'signup'

const route = useRoute()
const activeTab = ref<AuthTab>('signin')

const identifier = ref('')
const password = ref('')
const showPassword = ref(false)
const isSubmitting = ref(false)
const loginErrorMessage = ref('')

const registerDisplayName = ref('')
const registerUsername = ref('')
const registerEmail = ref('')
const registerPassword = ref('')
const registerConfirmPassword = ref('')
const registerRole = ref<RegisterRole>('STUDENT')
const showRegisterPassword = ref(false)
const showRegisterConfirmPassword = ref(false)
const isRegistering = ref(false)
const registerErrorMessage = ref('')
const registerSuccessMessage = ref('')

const { login, register, user } = useAuth()

const confirmedMessage = computed(() => {
  return route.query.confirmed === '1'
    ? 'Your email has been confirmed. You can now sign in.'
    : ''
})

watch(
  () => user.value,
  async (val) => {
    if (val) {
      await navigateTo('/')
    }
  },
  { immediate: true }
)

const resetRegisterForm = () => {
  registerDisplayName.value = ''
  registerUsername.value = ''
  registerEmail.value = ''
  registerPassword.value = ''
  registerConfirmPassword.value = ''
  registerRole.value = 'STUDENT'
  registerErrorMessage.value = ''
}

const submit = async () => {
  loginErrorMessage.value = ''

  if (!identifier.value.trim()) {
    loginErrorMessage.value = 'Email or username is required.'
    return
  }

  if (!password.value.trim()) {
    loginErrorMessage.value = 'Password is required.'
    return
  }

  isSubmitting.value = true

  try {
    await login(identifier.value.trim(), password.value)
    await navigateTo('/')
  } catch (error: any) {
    loginErrorMessage.value =
      error?.data?.message ||
      error?.statusMessage ||
      'Login failed.'
  } finally {
    isSubmitting.value = false
  }
}

const submitRegister = async () => {
  registerErrorMessage.value = ''
  registerSuccessMessage.value = ''

  if (!registerDisplayName.value.trim()) {
    registerErrorMessage.value = 'Display name is required.'
    return
  }

  if (!registerUsername.value.trim()) {
    registerErrorMessage.value = 'Username is required.'
    return
  }

  if (!registerEmail.value.trim()) {
    registerErrorMessage.value = 'Email is required.'
    return
  }

  if (!registerPassword.value.trim()) {
    registerErrorMessage.value = 'Password is required.'
    return
  }

  if (registerPassword.value.length < 6) {
    registerErrorMessage.value = 'Password must be at least 6 characters.'
    return
  }

  if (!registerConfirmPassword.value.trim()) {
    registerErrorMessage.value = 'Confirm password is required.'
    return
  }

  if (registerPassword.value !== registerConfirmPassword.value) {
    registerErrorMessage.value = 'Passwords do not match.'
    return
  }

  if (!['STUDENT', 'INSTRUCTOR'].includes(registerRole.value)) {
    registerErrorMessage.value = 'Please select a valid account type.'
    return
  }

  isRegistering.value = true

  try {
    const response = await register({
      display_name: registerDisplayName.value.trim(),
      username: registerUsername.value.trim(),
      email: registerEmail.value.trim(),
      password: registerPassword.value,
      confirmPassword: registerConfirmPassword.value,
      role_label: registerRole.value,
    })

    registerSuccessMessage.value =
      response?.message ||
      'Account created successfully. Please check your email to confirm your account.'

    identifier.value = registerEmail.value.trim()
    password.value = ''
    activeTab.value = 'signin'
    resetRegisterForm()
  } catch (error: any) {
    registerErrorMessage.value =
      error?.data?.message ||
      error?.statusMessage ||
      'Failed to create account.'
  } finally {
    isRegistering.value = false
  }
}
</script>

<template>
  <v-container fluid class="login-page pa-0">
    <v-row no-gutters class="fill-height">
      <v-col cols="12" lg="7" class="brand-side">
        <div class="brand-overlay" />

        <v-container class="fill-height pa-6 pa-md-10">
          <div class="brand-content">
            <div class="d-flex align-center ga-4 mb-6">
              <div class="logo-shell">
                <v-img
                  src="/logo.png"
                  alt="NETCODE Logo"
                  contain
                  class="logo-img"
                />
              </div>

              <div>
                <div class="text-overline text-white opacity-90">
                  Interactive Virtual Laboratory
                </div>
                <div class="text-h4 text-md-h3 font-weight-black text-white">
                  NETCODE
                </div>
              </div>
            </div>

            <div class="text-h3 text-md-h2 font-weight-black text-white mb-4 hero-title">
              Virtual learning, live classes, and future coding labs in one space.
            </div>

            <div class="text-body-1 text-md-h6 text-white opacity-90 mb-6 hero-subtitle">
              Access classroom sessions, manage attendance, and prepare for Code Lab and Simulator modules in a modern learning environment.
            </div>

            <div class="d-flex flex-wrap ga-2 mb-8">
              <v-chip color="white" variant="flat" rounded="pill" prepend-icon="mdi-video-outline">
                Online Class
              </v-chip>
              <v-chip color="white" variant="flat" rounded="pill" prepend-icon="mdi-code-tags">
                Code Lab
              </v-chip>
              <v-chip color="white" variant="flat" rounded="pill" prepend-icon="mdi-monitor-dashboard">
                Simulator
              </v-chip>
            </div>

            <v-row dense class="feature-grid">
              <v-col cols="12" md="4">
                <v-card rounded="xl" elevation="0" class="feature-card">
                  <v-card-text class="pa-4">
                    <v-avatar color="primary" variant="tonal" size="44" class="mb-3">
                      <v-icon>mdi-google-classroom</v-icon>
                    </v-avatar>
                    <div class="text-subtitle-1 font-weight-bold mb-1">
                      Smart Classrooms
                    </div>
                    <div class="text-body-2 text-medium-emphasis">
                      Organized class spaces for instructors and students.
                    </div>
                  </v-card-text>
                </v-card>
              </v-col>

              <v-col cols="12" md="4">
                <v-card rounded="xl" elevation="0" class="feature-card">
                  <v-card-text class="pa-4">
                    <v-avatar color="success" variant="tonal" size="44" class="mb-3">
                      <v-icon>mdi-account-check-outline</v-icon>
                    </v-avatar>
                    <div class="text-subtitle-1 font-weight-bold mb-1">
                      Live Attendance
                    </div>
                    <div class="text-body-2 text-medium-emphasis">
                      Track participation and readiness during active sessions.
                    </div>
                  </v-card-text>
                </v-card>
              </v-col>

              <v-col cols="12" md="4">
                <v-card rounded="xl" elevation="0" class="feature-card">
                  <v-card-text class="pa-4">
                    <v-avatar color="info" variant="tonal" size="44" class="mb-3">
                      <v-icon>mdi-rocket-launch-outline</v-icon>
                    </v-avatar>
                    <div class="text-subtitle-1 font-weight-bold mb-1">
                      Future Ready
                    </div>
                    <div class="text-body-2 text-medium-emphasis">
                      Built to expand into coding labs and simulation tools.
                    </div>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </div>
        </v-container>
      </v-col>

      <v-col cols="12" lg="5" class="form-side">
        <div class="form-wrap">
          <v-card rounded="xl" elevation="8" class="login-card">
            <v-card-text class="pa-6 pa-md-8">
              <div class="d-flex justify-center mb-5 d-lg-none">
                <div class="logo-shell mobile-logo">
                  <v-img
                    src="/logo.png"
                    alt="NETCODE Logo"
                    contain
                    class="logo-img"
                  />
                </div>
              </div>

              <div class="text-center text-lg-left mb-5">
                <div class="text-h4 font-weight-black mb-2">
                  Welcome
                </div>
                <div class="text-body-1 text-medium-emphasis">
                  Sign in to continue or create your account.
                </div>
              </div>

              <v-alert
                v-if="confirmedMessage"
                type="success"
                variant="tonal"
                rounded="xl"
                class="mb-4"
              >
                {{ confirmedMessage }}
              </v-alert>

              <v-alert
                v-if="registerSuccessMessage"
                type="success"
                variant="tonal"
                rounded="xl"
                class="mb-4"
              >
                {{ registerSuccessMessage }}
              </v-alert>

              <v-tabs
                v-model="activeTab"
                color="primary"
                grow
                class="mb-5"
              >
                <v-tab value="signin">Sign In</v-tab>
                <v-tab value="signup">Create Account</v-tab>
              </v-tabs>

              <v-window v-model="activeTab">
                <v-window-item value="signin">
                  <v-alert
                    v-if="loginErrorMessage"
                    type="error"
                    variant="tonal"
                    rounded="xl"
                    class="mb-4"
                  >
                    {{ loginErrorMessage }}
                  </v-alert>

                  <div class="d-flex flex-column ga-4">
                    <v-text-field
                      v-model="identifier"
                      label="Email or username"
                      placeholder="Enter your email or username"
                      prepend-inner-icon="mdi-account-outline"
                      rounded="xl"
                      hide-details="auto"
                      @keyup.enter="submit"
                    />

                    <v-text-field
                      v-model="password"
                      :type="showPassword ? 'text' : 'password'"
                      label="Password"
                      placeholder="Enter your password"
                      prepend-inner-icon="mdi-lock-outline"
                      :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
                      rounded="xl"
                      hide-details="auto"
                      @click:append-inner="showPassword = !showPassword"
                      @keyup.enter="submit"
                    />

                    <v-btn
                      color="primary"
                      size="large"
                      rounded="pill"
                      block
                      :loading="isSubmitting"
                      prepend-icon="mdi-login"
                      @click="submit"
                    >
                      Sign In
                    </v-btn>
                  </div>
                </v-window-item>

                <v-window-item value="signup">
                  <v-alert
                    v-if="registerErrorMessage"
                    type="error"
                    variant="tonal"
                    rounded="xl"
                    class="mb-4"
                  >
                    {{ registerErrorMessage }}
                  </v-alert>

                  <div class="d-flex flex-column ga-4">
                    <v-text-field
                      v-model="registerDisplayName"
                      label="Display name"
                      placeholder="Enter your full name"
                      prepend-inner-icon="mdi-account-circle-outline"
                      rounded="xl"
                      hide-details="auto"
                    />

                    <v-text-field
                      v-model="registerUsername"
                      label="Username"
                      placeholder="Choose a username"
                      prepend-inner-icon="mdi-at"
                      rounded="xl"
                      hide-details="auto"
                    />

                    <v-text-field
                      v-model="registerEmail"
                      label="Email"
                      placeholder="Enter your email"
                      prepend-inner-icon="mdi-email-outline"
                      rounded="xl"
                      hide-details="auto"
                    />

                    <v-select
                      v-model="registerRole"
                      label="Account type"
                      :items="[
                        { title: 'Student', value: 'STUDENT' },
                        { title: 'Instructor', value: 'INSTRUCTOR' }
                      ]"
                      prepend-inner-icon="mdi-account-badge-outline"
                      rounded="xl"
                      hide-details="auto"
                    />

                    <v-text-field
                      v-model="registerPassword"
                      :type="showRegisterPassword ? 'text' : 'password'"
                      label="Password"
                      placeholder="Create a password"
                      prepend-inner-icon="mdi-lock-outline"
                      :append-inner-icon="showRegisterPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
                      rounded="xl"
                      hide-details="auto"
                      @click:append-inner="showRegisterPassword = !showRegisterPassword"
                    />

                    <v-text-field
                      v-model="registerConfirmPassword"
                      :type="showRegisterConfirmPassword ? 'text' : 'password'"
                      label="Confirm password"
                      placeholder="Confirm your password"
                      prepend-inner-icon="mdi-shield-check-outline"
                      :append-inner-icon="showRegisterConfirmPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
                      rounded="xl"
                      hide-details="auto"
                      @click:append-inner="showRegisterConfirmPassword = !showRegisterConfirmPassword"
                    />

                    <v-btn
                      color="primary"
                      size="large"
                      rounded="pill"
                      block
                      :loading="isRegistering"
                      prepend-icon="mdi-account-plus-outline"
                      @click="submitRegister"
                    >
                      Create Account
                    </v-btn>
                  </div>

                  <div class="text-center text-body-2 text-medium-emphasis mt-5">
                    A confirmation email will be sent after registration. You must confirm your email before signing in.
                  </div>
                </v-window-item>
              </v-window>
            </v-card-text>
          </v-card>
        </div>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.08), transparent 28%),
    radial-gradient(circle at bottom left, rgba(99, 102, 241, 0.06), transparent 34%),
    #f5f7fb;
}

.brand-side {
  position: relative;
  min-height: 100vh;
  background:
    linear-gradient(135deg, rgba(37, 99, 235, 0.96), rgba(79, 70, 229, 0.95)),
    #2563eb;
  overflow: hidden;
}

.brand-overlay {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.18), transparent 22%),
    radial-gradient(circle at 80% 80%, rgba(255, 255, 255, 0.12), transparent 18%);
  pointer-events: none;
}

.brand-content {
  position: relative;
  z-index: 1;
  display: flex;
  min-height: 100%;
  flex-direction: column;
  justify-content: center;
}

.hero-title {
  max-width: 760px;
  line-height: 1.08;
}

.hero-subtitle {
  max-width: 720px;
  line-height: 1.5;
}

.logo-shell {
  width: 82px;
  height: 82px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
  flex-shrink: 0;
}

.mobile-logo {
  width: 74px;
  height: 74px;
  border-radius: 22px;
}

.logo-img {
  width: 100%;
  height: 100%;
}

.feature-card {
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.32);
  backdrop-filter: blur(8px);
  min-height: 100%;
}

.form-side {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 24px;
}

.form-wrap {
  width: 100%;
  max-width: 560px;
}

.login-card {
  border: 1px solid rgba(15, 23, 42, 0.06);
  background: rgba(255, 255, 255, 0.98);
}

@media (max-width: 1279px) {
  .brand-side {
    min-height: auto;
  }

  .form-side {
    min-height: auto;
    padding-top: 0;
  }
}

@media (max-width: 959px) {
  .brand-side {
    padding-bottom: 12px;
  }

  .hero-title {
    font-size: 2rem !important;
  }

  .hero-subtitle {
    font-size: 1rem !important;
  }
}

@media (max-width: 599px) {
  .form-side {
    padding: 16px;
  }

  .feature-grid {
    row-gap: 12px;
  }
}
</style>