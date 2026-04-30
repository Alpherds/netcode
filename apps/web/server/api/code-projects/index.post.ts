import { readBody } from 'h3'
import {
  createOwnedCodeProject,
  getCurrentStrapiUser,
} from '../../utils/strapi-code-projects'

export default defineEventHandler(async (event) => {
  const user = await getCurrentStrapiUser(event)
  const body = await readBody(event)

  const item = await createOwnedCodeProject(user.id, body)

  return { item }
})