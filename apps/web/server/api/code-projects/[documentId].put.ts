import { createError, getRouterParam, readBody } from 'h3'
import {
  getCurrentStrapiUser,
  updateOwnedCodeProject,
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

  const body = await readBody(event)
  const item = await updateOwnedCodeProject(documentId, user.id, body)

  return { item }
})