import { defineVuetifyConfiguration } from 'vuetify-nuxt-module/custom-configuration'

export default defineVuetifyConfiguration({
  defaults: {
    VCard: {
      rounded: 'xl',
      elevation: 2,
    },
    VBtn: {
      rounded: 'xl',
    },
    VTextField: {
      variant: 'outlined',
      density: 'comfortable',
      color: 'primary',
    },
    VTextarea: {
      variant: 'outlined',
      density: 'comfortable',
      color: 'primary',
    },
    VSelect: {
      variant: 'outlined',
      density: 'comfortable',
      color: 'primary',
    },
    VAlert: {
      variant: 'tonal',
      rounded: 'lg',
    },
    VChip: {
      rounded: 'xl',
    },
  },

  theme: {
    defaultTheme: 'netcodeLight',
    themes: {
      netcodeLight: {
        dark: false,
        colors: {
          primary: '#2563EB',
          secondary: '#06B6D4',
          accent: '#F43F5E',
          success: '#16A34A',
          warning: '#D97706',
          error: '#DC2626',
          info: '#0EA5E9',
          surface: '#FFFFFF',
          background: '#F5F7FB',
        },
      },
    },
  },

  icons: {
    defaultSet: 'mdi',
  },
})