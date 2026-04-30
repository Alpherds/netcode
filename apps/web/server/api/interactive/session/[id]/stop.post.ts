import { createError, getRouterParam } from 'h3'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const runnerUrl = String(config.INTERACTIVE_RUNNER_URL || '').replace(/\/+$/, '')

  if (!runnerUrl) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Missing INTERACTIVE_RUNNER_URL',
    })
  }

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing session id',
    })
  }

  try {
    const response = await $fetch<{ success: boolean }>(
      `${runnerUrl}/sessions/${id}/stop`,
      {
        method: 'POST',
      }
    )

    return response
  } catch (error: any) {
    throw createError({
      statusCode: error?.statusCode || 500,
      statusMessage:
        error?.data?.error ||
        error?.statusMessage ||
        'Failed to stop interactive session',
    })
  }
})