export default defineNuxtConfig({
  compatibilityDate: '2026-04-15',

  modules: ['vuetify-nuxt-module'],

  css: ['@mdi/font/css/materialdesignicons.css'],

runtimeConfig: {
  STRAPI_API_TOKEN: process.env.STRAPI_API_TOKEN || '',
  DAILY_API_KEY: process.env.NUXT_DAILY_API_KEY || process.env.DAILY_API_KEY || '',
  DAILY_ROOM_PREFIX:
    process.env.NUXT_DAILY_ROOM_PREFIX ||
    process.env.DAILY_ROOM_PREFIX ||
    'netcode-session-',
  public: {
    strapiUrl: process.env.NUXT_PUBLIC_STRAPI_URL || '',
  },
},

  vuetify: {
    moduleOptions: {},
    vuetifyOptions: './vuetify.config.ts',
  },
})