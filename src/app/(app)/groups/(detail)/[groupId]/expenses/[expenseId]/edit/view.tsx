'use client'

import { convexQuery } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import Link from 'next/link'

import { GroupExpenseForm } from '#/components/group-expense-form'
import { useGroup } from '#/components/use-group'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '#/components/ui/empty'
import { api } from '#convex/_generated/api'

export function EditExpenseView({ groupId, expenseId }: { groupId: string; expenseId: string }) {
  const group = useGroup()
  const { data: expense } = useSuspenseQuery(
    convexQuery(api.groups.expense, { groupId, expenseId }),
  )
  if (!group) return null

  if (!expense) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>This expense was deleted</EmptyTitle>
          <EmptyDescription>
            <Link href={`/groups/${group.id}`}>
              Back to the group
            </Link>
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  return <GroupExpenseForm group={group} expense={expense} />
}
