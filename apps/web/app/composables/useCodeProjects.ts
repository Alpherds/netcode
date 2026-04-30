import type {
  CodeProjectDto,
  SaveCodeProjectInput,
} from '~/types/code-project'

export function useCodeProjects() {
  async function list() {
    return await $fetch<{ items: CodeProjectDto[] }>('/api/code-projects')
  }

  async function getOne(documentId: string) {
    return await $fetch<{ item: CodeProjectDto }>(
      `/api/code-projects/${documentId}`
    )
  }

  async function create(input: SaveCodeProjectInput) {
    return await $fetch<{ item: CodeProjectDto }>('/api/code-projects', {
      method: 'POST',
      body: input,
    })
  }

  async function update(
    documentId: string,
    input: SaveCodeProjectInput
  ) {
    return await $fetch<{ item: CodeProjectDto }>(
      `/api/code-projects/${documentId}`,
      {
        method: 'PUT',
        body: input,
      }
    )
  }

  async function remove(documentId: string) {
    return await $fetch<{ success: true }>(
      `/api/code-projects/${documentId}`,
      {
        method: 'DELETE',
      }
    )
  }

  return {
    list,
    getOne,
    create,
    update,
    remove,
  }
}