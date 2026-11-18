'use client'

import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Receipt } from 'lucide-react'

import { CategoryIcon } from '#/components/category'
import { ExpenseFilters, useListSearch } from '#/components/expense-filters'
import {
  ExpenseRow,
  ExpenseSection,
  ExpenseTable,
  RowActions,
  type ExpenseColumn,
} from '#/components/expense-list'
import { useAction } from '#/components/ledger'
import { ReceiptLink } from '#/components/receipts'
import { useGroup } from '#/components/use-group'
import { categoryLabel, formatMoney, memberName } from '@settlr/shared/format'
import {
  LIST_STEP,
  expenseSearchDefaults,
  isFiltered,
  type ExpenseSearch,
} from '@settlr/shared/schemas'
import type { Group, GroupExpense } from '#/lib/types'
import { api } from '@settlr/backend/convex/_generated/api'

const columns: Array<ExpenseColumn> = [
  { label: 'Paid by', width: 'w-32', from: 'md', className: 'text-foreground' },
  { label: 'Split', width: 'w-28', from: '2xl' },
]

/**
 * A group's expenses. Filters, sorting and the list length (`search`) live
 * in the URL, so a filtered view is shareable and renders on the server.
 */
export function ExpensesView({ groupId, search }: { groupId: string; search: ExpenseSearch }) {
  const group = useGroup()
  const { data: page } = useSuspenseQuery(
    convexQuery(api.groups.expenses, { groupId, ...search }),
  )
  const { hrefFor, update, clearHref } = useListSearch(
    `/groups/${groupId}`,
    search,
    expenseSearchDefaults,
  )
  if (!group) return null

  const filtered = isFiltered(search)
  const payers = group.members.map((m) => ({
    value: m.id,
    label: m.id === group.meMemberId ? 'You paid' : `${m.name} paid`,
  }))

  return (
    <ExpenseSection
      filters={
        group.expenseCount > 0 && (
          <ExpenseFilters value={search} onChange={update} payers={payers} />
        )
      }
      empty={
        page.items.length === 0 &&
        (filtered
          ? {
              icon: <Receipt />,
              title: 'No matches',
              description: 'No expenses match these filters.',
              clearHref,
            }
          : {
              icon: <Receipt />,
              title: 'No expenses yet',
              description: 'Add the first expense to start splitting.',
            })
      }
      more={page.hasMore && hrefFor({ ...search, limit: search.limit + LIST_STEP })}
    >
      <ExpenseTable columns={columns}>
        {page.items.map((expense) => (
          <GroupExpenseRow key={expense.id} group={group} expense={expense} />
        ))}
      </ExpenseTable>
    </ExpenseSection>
  )
}

function GroupExpenseRow({ group, expense }: { group: Group; expense: GroupExpense }) {
  const removeExpense = useConvexMutation(api.groups.removeExpense)
  const { run } = useAction(removeExpense, { success: 'Deleted', toastErrors: true })
  const splitCount = expense.splitAmong.length
  const payer =
    expense.paidBy === group.meMemberId ? 'You' : memberName(group.members, expense.paidBy)
  const split = splitCount === group.members.length ? 'Everyone' : `${splitCount} people`

  return (
    <ExpenseRow
      icon={<CategoryIcon category={expense.category} />}
      title={expense.description}
      receipt={expense.receiptId && <ReceiptLink source="group" expenseId={expense.id} />}
      subtitle={categoryLabel(expense.category)}
      date={expense.date}
      cells={[{ value: payer, folded: `${payer} paid` }, split]}
      amount={formatMoney(expense.amountCents, group.currency)}
      actions={
        <RowActions
          name={expense.description}
          edit={{ href: `/groups/${group.id}/expenses/${expense.id}/edit` }}
          deleteDescription="Balances will be updated. This can’t be undone."
          onDelete={async () => Boolean(await run({ expenseId: expense.id }))}
        />
      }
    />
  )
}
