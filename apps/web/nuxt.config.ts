export default defineNuxtConfig({
  compatibilityDate: '2026-04-15',

  modules: [
    'vuetify-nuxt-module',
    '@tresjs/nuxt',
  ],

  css: ['@mdi/font/css/materialdesignicons.css'],

  runtimeConfig: {
    STRAPI_API_TOKEN: process.env.STRAPI_API_TOKEN || '',
    DAILY_API_KEY: process.env.NUXT_DAILY_API_KEY || process.env.DAILY_API_KEY || '',
    DAILY_ROOM_PREFIX:
      process.env.NUXT_DAILY_ROOM_PREFIX ||
      process.env.DAILY_ROOM_PREFIX ||
      'netcode-session-',

  JUDGE0_URL: process.env.JUDGE0_URL || '',
  JUDGE0_AUTH_TOKEN: process.env.JUDGE0_AUTH_TOKEN || '',
  JUDGE0_AUTH_HEADER: process.env.JUDGE0_AUTH_HEADER || 'X-Auth-Token',
  INTERACTIVE_RUNNER_URL: process.env.INTERACTIVE_RUNNER_URL || 'http://51.254.130.38:8081',

    public: {
      strapiUrl: process.env.NUXT_PUBLIC_STRAPI_URL || '',
    },
  },

  vuetify: {
    moduleOptions: {},
    vuetifyOptions: './vuetify.config.ts',
  },
})