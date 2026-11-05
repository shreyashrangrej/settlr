'use client'

import { GroupExpenseForm } from '#/components/group-expense-form'
import { useGroup } from '#/components/use-group'

export function NewExpenseView() {
  const group = useGroup()
  if (!group) return null
  return <GroupExpenseForm group={group} />
}
