import { createError, getRouterParam } from 'h3'
import {
  deleteOwnedCodeProject,
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

  return await deleteOwnedCodeProject(documentId, user.id)
})