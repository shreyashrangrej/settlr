import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { Prefetched } from '#/components/prefetched'
import { prefetchQuery } from '#/server/convex.server'
import { api } from '#convex/_generated/api'
import { EditExpenseView } from './view'

export const metadata: Metadata = { title: 'Edit expense · Settlr' }

type Props = { params: Promise<{ groupId: string; expenseId: string }> }

// SSR: full. The expense is prefetched (the group comes from the layout)
// and stays live, so a delete elsewhere shows up here.
export default async function EditExpensePage({ params }: Props) {
  const { groupId, expenseId } = await params
  const expense = await prefetchQuery(api.groups.expense, { groupId, expenseId })
  if (!expense.data) notFound()
  return (
    <Prefetched queries={[expense.entry]}>
      <EditExpenseView groupId={groupId} expenseId={expenseId} />
    </Prefetched>
  )
}
