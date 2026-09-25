import { createFileRoute } from '@tanstack/react-router'

import { GroupExpenseForm } from '#/components/group-expense-form'
import { useGroup } from '#/components/use-group'

// SSR: full. The form needs no data beyond the group, which the parent
// route has already loaded.
export const Route = createFileRoute('/_app/groups/$groupId/expenses/new')({
  head: () => ({ meta: [{ title: 'Add expense · Settlr' }] }),
  component: NewExpensePage,
})

function NewExpensePage() {
  const group = useGroup()
  if (!group) return null
  return <GroupExpenseForm group={group} />
}
