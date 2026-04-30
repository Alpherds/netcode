import {
  getCurrentStrapiUser,
  listOwnedCodeProjects,
} from '../../utils/strapi-code-projects'

export default defineEventHandler(async (event) => {
  const user = await getCurrentStrapiUser(event)
  const items = await listOwnedCodeProjects(user.id)

  return { items }
})