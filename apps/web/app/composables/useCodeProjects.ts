import type {
  CodeProjectDto,
  SaveCodeProjectInput,
} from '../types/code-project'

function buildAuthHeaders(token: string) {
  if (!token) {
    throw new Error('Missing auth token')
  }

  return {
    Authorization: `Bearer ${token}`,
  }
}

export function useCodeProjects() {
  async function list(token: string) {
    return await $fetch<{ items: CodeProjectDto[] }>('/api/code-projects', {
      headers: buildAuthHeaders(token),
    })
  }

  async function getOne(documentId: string, token: string) {
    return await $fetch<{ item: CodeProjectDto }>(
      `/api/code-projects/${documentId}`,
      {
        headers: buildAuthHeaders(token),
      }
    )
  }

  async function create(input: SaveCodeProjectInput, token: string) {
    return await $fetch<{ item: CodeProjectDto }>('/api/code-projects', {
      method: 'POST',
      headers: buildAuthHeaders(token),
      body: input,
    })
  }

  async function update(
    documentId: string,
    input: SaveCodeProjectInput,
    token: string
  ) {
    return await $fetch<{ item: CodeProjectDto }>(
      `/api/code-projects/${documentId}`,
      {
        method: 'PUT',
        headers: buildAuthHeaders(token),
        body: input,
      }
    )
  }

  async function remove(documentId: string, token: string) {
    return await $fetch<{ success: true }>(`/api/code-projects/${documentId}`, {
      method: 'DELETE',
      headers: buildAuthHeaders(token),
    })
  }

  return {
    list,
    getOne,
    create,
    update,
    remove,
  }
}