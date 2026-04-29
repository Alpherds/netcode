import { createError, readBody } from 'h3'

type RunRequestBody = {
  language_id?: number
  source_code?: string
  stdin?: string
}

type Judge0CreateResponse = {
  token: string
}

type Judge0SubmissionResponse = {
  stdout?: string | null
  stderr?: string | null
  compile_output?: string | null
  message?: string | null
  exit_code?: number | null
  time?: string | number | null
  memory?: number | null
  status?: {
    id: number
    description: string
  } | null
}

function buildHeaders(
  authHeaderName: string,
  authToken: string
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }

  if (authToken.trim()) {
    headers[authHeaderName] = authToken.trim()
  }

  return headers
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody<RunRequestBody>(event)

  if (!config.JUDGE0_URL) {
    throw createError({
      statusCode: 500,
      statusMessage: 'JUDGE0_URL is not configured.',
    })
  }

  const languageId = Number(body.language_id)

  if (!languageId || Number.isNaN(languageId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A valid language_id is required.',
    })
  }

  const sourceCode = String(body.source_code || '')
  if (!sourceCode.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Source code is required.',
    })
  }

  const judge0Base = config.JUDGE0_URL.replace(/\/$/, '')
  const headers = buildHeaders(
    config.JUDGE0_AUTH_HEADER,
    config.JUDGE0_AUTH_TOKEN
  )

  try {
    const created = await $fetch<Judge0CreateResponse>(
      `${judge0Base}/submissions?base64_encoded=false`,
      {
        method: 'POST',
        headers,
        body: {
          language_id: languageId,
          source_code: sourceCode,
          stdin: String(body.stdin || ''),
          cpu_time_limit: 2,
          wall_time_limit: 5,
          memory_limit: 128000,
        },
      }
    )

    if (!created?.token) {
      throw new Error('Judge0 did not return a submission token.')
    }

    const fields = [
      'stdout',
      'stderr',
      'compile_output',
      'message',
      'exit_code',
      'time',
      'memory',
      'status',
      'token',
    ].join(',')

    let submission: Judge0SubmissionResponse | null = null

    for (let attempt = 0; attempt < 25; attempt++) {
      submission = await $fetch<Judge0SubmissionResponse>(
        `${judge0Base}/submissions/${created.token}?base64_encoded=false&fields=${fields}`,
        {
          method: 'GET',
          headers,
        }
      )

      const statusId = Number(submission?.status?.id || 0)

      if (statusId !== 1 && statusId !== 2) {
        break
      }

      await sleep(700)
    }

    if (!submission) {
      throw new Error('No submission result returned from Judge0.')
    }

    const statusId = Number(submission?.status?.id || 0)
    const statusDescription = String(
      submission?.status?.description || 'Unknown'
    )

    return {
      ok: true,
      status_id: statusId,
      status_description: statusDescription,
      stdout: submission.stdout || '',
      stderr: submission.stderr || '',
      compile_output: submission.compile_output || '',
      message: submission.message || '',
      exit_code: submission.exit_code ?? null,
      time: submission.time ?? null,
      memory: submission.memory ?? null,
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage:
        error?.data?.error ||
        error?.data?.message ||
        error?.message ||
        'Failed to run code via Judge0.',
    })
  }
})