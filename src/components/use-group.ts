'use client'

import { convexQuery } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'

import type { Group } from '#/lib/types'
import { api } from '#convex/_generated/api'

/**
 * The group open under /groups/[groupId] (its layout prefetched it on the
 * server), or null once it's deleted. Live: updates as expenses change.
 */
export function useGroup(): Group | null {
  const { groupId } = useParams<{ groupId: string }>()
  return useSuspenseQuery(convexQuery(api.groups.get, { groupId })).data
}
