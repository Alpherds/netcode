import { createError, getHeader, type H3Event } from 'h3'
import type { CodeProjectDto } from '../../app/types/code-project'

type StrapiUser = {
  id: number
  username: string
  email: string
}

type StrapiListResponse<T> = {
  data: T[]
  meta?: Record<string, unknown>
}

type StrapiSingleResponse<T> = {
  data: T
  meta?: Record<string, unknown>
}

type StrapiMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

type StrapiAdminFetchOptions = {
  method?: StrapiMethod
  body?: Record<string, any> | undefined
}

function getStrapiBaseUrl() {
  const config = useRuntimeConfig()
  const baseUrl = String(config.public.strapiUrl || '').replace(/\/+$/, '')

  if (!baseUrl) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Missing NUXT_PUBLIC_STRAPI_URL',
    })
  }

  return baseUrl
}

function getStrapiApiToken() {
  const config = useRuntimeConfig()
  const token = String(config.STRAPI_API_TOKEN || '')

  if (!token) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Missing STRAPI_API_TOKEN',
    })
  }

  return token
}

export function getBearerToken(event: H3Event) {
  const authHeader = getHeader(event, 'authorization') || ''

  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Missing authorization token',
    })
  }

  const token = authHeader.slice(7).trim()

  if (!token) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid authorization token',
    })
  }

  return token
}

export async function getCurrentStrapiUser(
  event: H3Event
): Promise<StrapiUser> {
  const jwt = getBearerToken(event)
  const baseUrl = getStrapiBaseUrl()

  try {
    return await $fetch<StrapiUser>(`${baseUrl}/api/users/me`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    })
  } catch {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unable to verify authenticated user',
    })
  }
}

export async function strapiAdminFetch<T>(
  path: string,
  options: StrapiAdminFetchOptions = {}
): Promise<T> {
  const baseUrl = getStrapiBaseUrl()
  const apiToken = getStrapiApiToken()

  const response = await $fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: options.body,
  })

  return response as T
}

export function normalizeCodeProject(entry: any): CodeProjectDto {
  const raw = entry?.attributes
    ? {
        id: entry.id,
        documentId: entry.documentId ?? entry.attributes.documentId,
        ...entry.attributes,
      }
    : entry

  return {
    id: raw.id,
    documentId: raw.documentId,
    title: raw.title ?? '',
    language: raw.language ?? 'cpp',
    sourceCode: raw.sourceCode ?? '',
    stdin: raw.stdin ?? '',
    latestStdout: raw.latestStdout ?? '',
    latestStderr: raw.latestStderr ?? '',
    latestCompileOutput: raw.latestCompileOutput ?? '',
    latestMessage: raw.latestMessage ?? '',
    latestStatus: raw.latestStatus ?? '',
    latestTime: raw.latestTime ?? '',
    latestMemory:
      typeof raw.latestMemory === 'number' ? raw.latestMemory : null,
    latestExitCode:
      typeof raw.latestExitCode === 'number' ? raw.latestExitCode : null,
    isSubmitted: Boolean(raw.isSubmitted),
    exerciseKey: raw.exerciseKey ?? '',
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  }
}

export function buildCodeProjectPayload(body: any) {
  const language = String(body?.language || '').trim() as
    | 'cpp'
    | 'java'
    | 'python'

  if (!['cpp', 'java', 'python'].includes(language)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid language',
    })
  }

  const title = String(body?.title || '').trim()
  const sourceCode = String(body?.sourceCode || '')
  const stdin = String(body?.stdin || '')
  const latestStdout = String(body?.latestStdout || '')
  const latestStderr = String(body?.latestStderr || '')
  const latestCompileOutput = String(body?.latestCompileOutput || '')
  const latestMessage = String(body?.latestMessage || '')
  const latestStatus = String(body?.latestStatus || '')
  const latestTime = String(body?.latestTime || '')
  const exerciseKey = String(body?.exerciseKey || '')
  const isSubmitted = Boolean(body?.isSubmitted)

  if (!title) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Title is required',
    })
  }

  if (!sourceCode.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Source code is required',
    })
  }

  const latestMemory =
    typeof body?.latestMemory === 'number'
      ? body.latestMemory
      : body?.latestMemory
        ? Number(body.latestMemory)
        : null

  const latestExitCode =
    typeof body?.latestExitCode === 'number'
      ? body.latestExitCode
      : body?.latestExitCode !== undefined &&
          body?.latestExitCode !== null &&
          body?.latestExitCode !== ''
        ? Number(body.latestExitCode)
        : null

  return {
    title,
    language,
    sourceCode,
    stdin,
    latestStdout,
    latestStderr,
    latestCompileOutput,
    latestMessage,
    latestStatus,
    latestTime,
    latestMemory: Number.isFinite(latestMemory) ? latestMemory : null,
    latestExitCode: Number.isFinite(latestExitCode) ? latestExitCode : null,
    isSubmitted,
    exerciseKey,
  }
}

export async function findOwnedCodeProject(
  documentId: string,
  ownerId: number
): Promise<CodeProjectDto | null> {
  const params = new URLSearchParams()
  params.set('filters[documentId][$eq]', documentId)
  params.set('filters[owner][id][$eq]', String(ownerId))
  params.set('pagination[pageSize]', '1')

  const response = await strapiAdminFetch<StrapiListResponse<any>>(
    `/api/code-projects?${params.toString()}`
  )

  const first = response.data?.[0]

  return first ? normalizeCodeProject(first) : null
}

export async function listOwnedCodeProjects(ownerId: number) {
  const params = new URLSearchParams()
  params.set('filters[owner][id][$eq]', String(ownerId))
  params.set('sort[0]', 'updatedAt:desc')
  params.set('pagination[pageSize]', '100')

  const response = await strapiAdminFetch<StrapiListResponse<any>>(
    `/api/code-projects?${params.toString()}`
  )

  return response.data.map(normalizeCodeProject)
}

export async function createOwnedCodeProject(ownerId: number, body: any) {
  const payload = buildCodeProjectPayload(body)

  const response = await strapiAdminFetch<StrapiSingleResponse<any>>(
    '/api/code-projects',
    {
      method: 'POST',
      body: {
        data: {
          ...payload,
          owner: ownerId,
        },
      },
    }
  )

  return normalizeCodeProject(response.data)
}

export async function updateOwnedCodeProject(
  documentId: string,
  ownerId: number,
  body: any
) {
  const existing = await findOwnedCodeProject(documentId, ownerId)

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Code project not found',
    })
  }

  const payload = buildCodeProjectPayload(body)

  const response = await strapiAdminFetch<StrapiSingleResponse<any>>(
    `/api/code-projects/${documentId}`,
    {
      method: 'PUT',
      body: {
        data: payload,
      },
    }
  )

  return normalizeCodeProject(response.data)
}

export async function deleteOwnedCodeProject(
  documentId: string,
  ownerId: number
) {
  const existing = await findOwnedCodeProject(documentId, ownerId)

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Code project not found',
    })
  }

  await strapiAdminFetch(`/api/code-projects/${documentId}`, {
    method: 'DELETE',
  })

  return { success: true }
}