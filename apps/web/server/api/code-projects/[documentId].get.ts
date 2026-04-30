import { createError, getRouterParam } from 'h3'
import {
  findOwnedCodeProject,
  getCurrentStrapiUser,
} from '../../utils/strapi-code-projects'

export default defineEventHandler(async (event) => {
  const user = await getCurrentStrapiUser(event)
  const documentId = getRouterParam(event, 'documentId')

  if (!documentId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing documentId',
    })
  }

  const item = await findOwnedCodeProject(documentId, user.id)

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Code project not found',
    })
  }

  return { item }
})