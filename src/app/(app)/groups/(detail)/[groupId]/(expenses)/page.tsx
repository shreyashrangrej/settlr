import { Prefetched } from '#/components/prefetched'
import { expenseSearchSchema } from '#/lib/schemas'
import { parseSearch } from '#/lib/search'
import { prefetchQuery } from '#/server/convex.server'
import { api } from '#convex/_generated/api'
import { ExpensesView } from './view'

type Props = {
  params: Promise<{ groupId: string }>
  searchParams: Promise<Record<string, string | Array<string> | undefined>>
}

// SSR: full. Filters, sorting and the list length live in the URL,
// validated by a zod schema (bad values fall back to defaults), so a
// filtered view is shareable and renders fully on the server. The list is a
// live Convex query.
export default async function ExpensesPage({ params, searchParams }: Props) {
  const { groupId } = await params
  const search = parseSearch(expenseSearchSchema, await searchParams)
  const expenses = await prefetchQuery(api.groups.expenses, { groupId, ...search })
  return (
    <Prefetched queries={[expenses.entry]}>
      <ExpensesView groupId={groupId} search={search} />
    </Prefetched>
  )
}
