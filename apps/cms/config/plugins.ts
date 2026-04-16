import type { Core } from '@strapi/strapi'

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
 email: {
  config: {
    provider: 'nodemailer',
    providerOptions: {
      host: env('SMTP_HOST'),
      port: env.int('SMTP_PORT', 465),
      secure: env.bool('SMTP_SECURE', true),
      auth: {
        user: env('SMTP_USER'),
        pass: env('SMTP_PASS'),
      },
    },
    settings: {
      defaultFrom: env('EMAIL_DEFAULT_FROM'),
      defaultReplyTo: env('EMAIL_DEFAULT_REPLY_TO'),
    },
  },
},
})

export default config