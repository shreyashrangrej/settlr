import { convexQuery } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute, notFound } from '@tanstack/react-router'

import { GroupExpenseForm } from '#/components/group-expense-form'
import { FormSkeleton } from '#/components/skeletons'
import { useGroup } from '#/components/use-group'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '#/components/ui/empty'
import { api } from '#convex/_generated/api'

// SSR: full. The expense is prefetched (the group comes from the layout)
// and stays live, so a delete elsewhere shows up here.
export const Route = createFileRoute('/_app/groups/$groupId/expenses/$expenseId/edit')({
  loader: async ({ context, params }) => {
    const expense = await context.queryClient.ensureQueryData(
      convexQuery(api.groups.expense, params),
    )
    if (!expense) throw notFound()
  },
  head: () => ({ meta: [{ title: 'Edit expense · Settlr' }] }),
  pendingComponent: FormSkeleton,
  component: EditExpensePage,
})

function EditExpensePage() {
  const params = Route.useParams()
  const group = useGroup()
  const { data: expense } = useSuspenseQuery(convexQuery(api.groups.expense, params))
  if (!group) return null

  if (!expense) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>This expense was deleted</EmptyTitle>
          <EmptyDescription>
            <Link to="/groups/$groupId" params={{ groupId: group.id }}>
              Back to the group
            </Link>
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  return <GroupExpenseForm group={group} expense={expense} />
}
