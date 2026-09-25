import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { Prefetched } from '#/components/prefetched'
import { prefetchQuery } from '#/server/convex.server'
import { api } from '#convex/_generated/api'
import { ReceiptView } from './view'

type Props = { params: Promise<{ source: string; expenseId: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { source, expenseId } = await params
  const { data } = await prefetchQuery(api.receipts.forExpense, { source, expenseId })
  return data ? { title: `Receipt · ${data.expense.description} · Settlr` } : {}
}

// SSR: full. An expense's receipt, shown inside the app. `source` is
// personal, friend or group; the query checks the viewer can see that
// expense (a bad URL is a 404).
export default async function ReceiptPage({ params }: Props) {
  const { source, expenseId } = await params
  const receipt = await prefetchQuery(api.receipts.forExpense, { source, expenseId })
  if (!receipt.data) notFound()
  return (
    <Prefetched queries={[receipt.entry]}>
      <ReceiptView source={source} expenseId={expenseId} />
    </Prefetched>
  )
}
