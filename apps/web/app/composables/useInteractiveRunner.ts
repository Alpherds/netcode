export type InteractiveLanguage = 'python' | 'cpp' | 'java'

export type CreateInteractiveSessionResponse = {
  sessionId: string
  wsUrl: string
}

export function useInteractiveRunner() {
  async function createSession(payload: {
    language: InteractiveLanguage
    sourceCode: string
  }) {
    return await $fetch<CreateInteractiveSessionResponse>(
      '/api/interactive/session',
      {
        method: 'POST',
        body: payload,
      }
    )
  }

  async function stopSession(sessionId: string) {
    return await $fetch<{ success: boolean }>(
      `/api/interactive/session/${sessionId}/stop`,
      {
        method: 'POST',
      }
    )
  }

  return {
    createSession,
    stopSession,
  }
}