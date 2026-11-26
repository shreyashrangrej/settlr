'use client'

import { useState } from 'react'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { MessageSquare, Receipt } from 'lucide-react'

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
import { CommentsDialog } from '#/components/comments'
import { UNDO_DESCRIPTION, useDeleteWithUndo } from '#/components/undo'
import { DropdownMenuItem } from '#/components/ui/dropdown-menu'
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
  const removeExpense = useDeleteWithUndo(useConvexMutation(api.groups.removeExpense))
  const [commenting, setCommenting] = useState(false)
  const splitCount = expense.splitAmong.length
  const payer =
    expense.paidBy === group.meMemberId ? 'You' : memberName(group.members, expense.paidBy)
  const who = splitCount === group.members.length ? 'Everyone' : `${splitCount} people`
  const split =
    expense.splitMode === 'equal'
      ? who
      : `${who}, ${SPLIT_LABEL[expense.splitMode]}`
  const share = expense.owed[group.meMemberId] ?? null

  return (
    <ExpenseRow
      icon={<CategoryIcon category={expense.category} />}
      title={expense.description}
      receipt={expense.receiptId && <ReceiptLink source="group" expenseId={expense.id} />}
      tags={expense.tags}
      subtitle={
        <>
          {categoryLabel(expense.category)}
          {expense.original &&
            ` · ${formatMoney(expense.original.amountCents, expense.original.currency)} paid`}
          {expense.recurring && ' · Repeats'}
        </>
      }
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
        <>
          <RowActions
            name={expense.description}
            edit={{
              dialog: (state) => (
                <ExpenseDialog target={{ kind: 'group', group, expense }} {...state} />
              ),
            }}
            deleteDescription={UNDO_DESCRIPTION}
            onDelete={() => removeExpense({ expenseId: expense.id })}
            items={
              <DropdownMenuItem onClick={() => setCommenting(true)}>
                <MessageSquare />
                Comments
              </DropdownMenuItem>
            }
          />
          <CommentsDialog
            expenseId={expense.id}
            title={expense.description}
            open={commenting}
            onOpenChange={setCommenting}
          />
        </>
      }
    />
  )
}

const SPLIT_LABEL = {
  exact: 'by amount',
  percent: 'by %',
  shares: 'by shares',
  items: 'by item',
} as const
