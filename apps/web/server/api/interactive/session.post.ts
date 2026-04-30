import { createError, readBody } from 'h3'

type CreateInteractiveSessionBody = {
  language?: 'python' | 'cpp' | 'java'
  sourceCode?: string
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const runnerUrl = String(config.INTERACTIVE_RUNNER_URL || '').replace(/\/+$/, '')

  if (!runnerUrl) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Missing INTERACTIVE_RUNNER_URL',
    })
  }

  const body = await readBody<CreateInteractiveSessionBody>(event)

  const language = body?.language
  const sourceCode = body?.sourceCode

  if (!language || !sourceCode) {
    throw createError({
      statusCode: 400,
      statusMessage: 'language and sourceCode are required',
    })
  }

  if (!['python', 'cpp', 'java'].includes(language)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Unsupported interactive language',
    })
  }

  try {
    const response = await $fetch<{ sessionId: string }>(`${runnerUrl}/sessions`, {
      method: 'POST',
      body: {
        language,
        sourceCode,
      },
    })

    return {
      sessionId: response.sessionId,
      wsUrl: `${runnerUrl.replace(/^http/, 'ws')}/ws/${response.sessionId}`,
    }
  } catch (error: any) {
    throw createError({
      statusCode: error?.statusCode || 500,
      statusMessage:
        error?.data?.error ||
        error?.statusMessage ||
        'Failed to create interactive session',
    })
  }
})