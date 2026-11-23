'use client'

import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Receipt } from 'lucide-react'

import { CategoryIcon } from '#/components/category'
import { ExpenseDialog } from '#/components/expense-dialog'
import { ExpenseFilters, useListSearch } from '#/components/expense-filters'
import {
  ExpenseRow,
  ExpenseSection,
  ExpenseTable,
  RowActions,
  YourShare,
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
      <ExpenseTable columns={['Paid by', 'Split']}>
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
  const share = myShare(expense, group)

  return (
    <ExpenseRow
      icon={<CategoryIcon category={expense.category} />}
      title={expense.description}
      receipt={expense.receiptId && <ReceiptLink source="group" expenseId={expense.id} />}
      subtitle={categoryLabel(expense.category)}
      date={expense.date}
      cells={[{ value: payer, folded: `${payer} paid` }, split]}
      amount={
        <>
          <span>{formatMoney(expense.amountCents, group.currency)}</span>
          {share !== null && share !== expense.amountCents && (
            <YourShare cents={formatMoney(share, group.currency)} />
          )}
        </>
      }
      actions={
        <RowActions
          name={expense.description}
          edit={{
            dialog: (state) => (
              <ExpenseDialog target={{ kind: 'group', group, expense }} {...state} />
            ),
          }}
          deleteDescription="Balances will be updated. This can’t be undone."
          onDelete={async () => Boolean(await run({ expenseId: expense.id }))}
        />
      }
    />
  )
}

/**
 * Your share of a group expense, or null when you're not in its split. The
 * same equal split as the backend (`shares` in convex/lib/ledger.ts):
 * leftover cents go to the first participants in member order.
 */
function myShare(expense: GroupExpense, group: Group) {
  const order = group.members.map((m) => m.id)
  const participants = [...expense.splitAmong].sort((a, b) => order.indexOf(a) - order.indexOf(b))
  const i = participants.indexOf(group.meMemberId)
  if (i === -1) return null
  const base = Math.floor(expense.amountCents / participants.length)
  const remainder = expense.amountCents - base * participants.length
  return base + (i < remainder ? 1 : 0)
}
