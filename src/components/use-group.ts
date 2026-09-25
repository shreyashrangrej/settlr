import { convexQuery } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'

import type { Group } from '#/lib/types'
import { api } from '#convex/_generated/api'

/**
 * The group open under /groups/$groupId (its layout's loader prefetched
 * it), or null once it's deleted. Live: updates as expenses change.
 */
export function useGroup(): Group | null {
  const { groupId } = useParams({ from: '/_app/groups/$groupId' })
  return useSuspenseQuery(convexQuery(api.groups.get, { groupId })).data
}
