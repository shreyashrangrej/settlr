import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { Prefetched } from '#/components/prefetched'
import { prefetchQuery } from '#/server/convex.server'
import { api } from '#convex/_generated/api'
import { GroupLayoutView } from './group-layout'

type Props = { params: Promise<{ groupId: string }>; children: React.ReactNode }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { groupId } = await params
  const { data: group } = await prefetchQuery(api.groups.get, { groupId })
  return group ? { title: `${group.name} · Settlr` } : {}
}

// SSR: full. The group (members, balances and the settle-up plan are kept
// up to date on the group document) is prefetched on the server and stays
// live afterwards, so adding an expense updates the balances without a
// refetch. Its pages (expenses, insights, edit) render inside.
export default async function GroupLayout({ params, children }: Props) {
  const { groupId } = await params
  const group = await prefetchQuery(api.groups.get, { groupId })
  if (!group.data) notFound()
  return (
    <Prefetched queries={[group.entry]}>
      <GroupLayoutView>{children}</GroupLayoutView>
    </Prefetched>
  )
}
