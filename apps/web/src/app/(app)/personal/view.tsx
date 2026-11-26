'use client'

import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { PiggyBank, Plus, Receipt, Tag, TrendingUp, Wallet } from 'lucide-react'

import { CategoryIcon } from '#/components/category'
import { ExpenseFilters, useListSearch } from '#/components/expense-filters'
import {
  ExpenseRow,
  ExpenseSection,
  ExpenseTable,
  RowActions,
} from '#/components/expense-list'
import { ExpensePage, PageIcon } from '#/components/expense-page'
import { ExpenseDialog, type PersonalExpense } from '#/components/expense-dialog'
import { useDeleteWithUndo } from '#/components/undo'
import { MonthNav } from '#/components/month-nav'
import { PageHeader } from '#/components/page-header'
import { ReceiptLink } from '#/components/receipts'
import { StatCard, StatGrid } from '#/components/stat-card'
import { Button, buttonVariants } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Progress, ProgressLabel, ProgressValue } from '#/components/ui/progress'
import { categoryLabel, formatMoney, formatMonth } from '@settlr/shared/format'
import {
  isFiltered,
  personalSearchDefaults,
  type ExpenseFilter,
  type PersonalSearch,
} from '@settlr/shared/schemas'
import type { PersonalMonth } from '#/lib/types'
import { cn } from '#/lib/utils'
import { api } from '@settlr/backend/convex/_generated/api'

/**
 * Your own spending for `month`. `thisMonth` comes from the server, so the
 * server and client render the same month. `search` has the list's filters,
 * which apply to the month's expenses (all loaded, for the totals).
 */
export function PersonalView({
  month,
  thisMonth,
  search,
}: {
  month: string
  thisMonth: string
  search: PersonalSearch
}) {
  const { data } = useSuspenseQuery(convexQuery(api.personal.month, { month }))
  const { update, clearHref } = useListSearch('/personal', search, personalSearchDefaults)
  const items = filterExpenses(data.items, search)

  return (
    <>
      <PageHeader
        media={
          <PageIcon>
            <Wallet />
          </PageIcon>
        }
        title="Personal expenses"
        description="Spending that’s just yours, not split with anyone."
        actions={
          <>
            <MonthNav to="/personal" month={month} thisMonth={thisMonth} />
            <Link
              href={month === thisMonth ? '/budget' : `/budget?month=${month}`}
              className={cn(buttonVariants({ variant: 'outline' }), 'no-underline')}
            >
              <PiggyBank />
              Monthly budget
            </Link>
            <ExpenseDialog target={{ kind: 'personal', month }} trigger={<Button />}>
              <Plus />
              Add expense
            </ExpenseDialog>
          </>
        }
      />

      <ExpensePage stats={<MonthStats data={data} />} aside={<ByCategory data={data} />}>
        <ExpenseSection
          filters={
            data.items.length > 0 && <ExpenseFilters value={search} onChange={update} />
          }
          empty={
            items.length === 0 &&
            (data.items.length > 0
              ? {
                  icon: <Wallet />,
                  title: 'No matches',
                  description: `No expenses in ${formatMonth(month)} match these filters.`,
                  clearHref,
                }
              : {
                  icon: <Wallet />,
                  title: `No expenses in ${formatMonth(month)}`,
                  description: 'Log what you spend to see where it goes.',
                })
          }
          note={data.truncated && `Showing the first ${data.items.length} expenses of this month.`}
        >
          <ExpenseTable columns={['Paid by', 'Split']}>
            {items.map((expense) => (
              <PersonalExpenseRow key={expense.id} expense={expense} />
            ))}
          </ExpenseTable>
        </ExpenseSection>
      </ExpensePage>
    </>
  )
}

function MonthStats({ data }: { data: PersonalMonth }) {
  // Averages and the top category are for the main currency (the one with
  // the most spent); other currencies still count in the total.
  const main = data.totals[0]
  const inMain = main ? data.items.filter((e) => e.currency === main.currency) : []
  const top = main ? data.byCategory.find((row) => row.currency === main.currency) : undefined
  const largest = inMain.reduce<(typeof inMain)[number] | undefined>(
    (max, e) => (!max || e.amountCents > max.amountCents ? e : max),
    undefined,
  )

  return (
    <StatGrid>
      <StatCard
        label={`Spent in ${formatMonth(data.month)}`}
        icon={<Wallet />}
        value={data.totals.map((t) => formatMoney(t.cents, t.currency)).join(' + ')}
      />
      <StatCard
        label="Expenses"
        icon={<Receipt />}
        value={data.items.length || ''}
        hint={main && `Avg ${formatMoney(Math.round(main.cents / inMain.length), main.currency)}`}
      />
      <StatCard
        label="Top category"
        icon={<Tag />}
        value={top ? categoryLabel(top.category) : ''}
        hint={top && formatMoney(top.cents, top.currency)}
      />
      <StatCard
        label="Largest expense"
        icon={<TrendingUp />}
        value={largest ? formatMoney(largest.amountCents, largest.currency) : ''}
        hint={largest?.description}
      />
    </StatGrid>
  )
}

function ByCategory({ data }: { data: PersonalMonth }) {
  const max = Math.max(...data.byCategory.map((r) => r.cents), 1)
  return (
    <Card>
      <CardHeader>
        <CardTitle>By category</CardTitle>
        <CardDescription>Your personal spending this month.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {data.byCategory.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing to show yet.</p>
        ) : (
          data.byCategory.map((row) => (
            <Progress key={`${row.currency}:${row.category}`} value={(row.cents / max) * 100}>
              <ProgressLabel className="text-sm">{categoryLabel(row.category)}</ProgressLabel>
              <ProgressValue className="ml-auto text-sm font-medium tabular-nums">
                {() => formatMoney(row.cents, row.currency)}
              </ProgressValue>
            </Progress>
          ))
        )}
      </CardContent>
    </Card>
  )
}


/** The month's expenses that match `filter`, in its order. */
function filterExpenses(items: Array<PersonalExpense>, filter: ExpenseFilter) {
  if (!isFiltered(filter) && filter.sort === 'date' && filter.order === 'desc') return items
  const q = filter.q.toLowerCase()
  const dir = filter.order === 'asc' ? 1 : -1
  return items
    .filter(
      (e) =>
        (filter.category === 'all' || e.category === filter.category) &&
        (!q || e.description.toLowerCase().includes(q)),
    )
    .sort((a, b) =>
      filter.sort === 'amount'
        ? (a.amountCents - b.amountCents) * dir
        : a.date.localeCompare(b.date) * dir,
    )
}

function PersonalExpenseRow({ expense }: { expense: PersonalExpense }) {
  const removeExpense = useDeleteWithUndo(useConvexMutation(api.personal.remove))

  return (
    <ExpenseRow
      icon={<CategoryIcon category={expense.category} />}
      title={expense.description}
      tags={expense.tags}
      receipt={expense.receiptId && <ReceiptLink source="personal" expenseId={expense.id} />}
      subtitle={`${categoryLabel(expense.category)}${expense.recurring ? ' · Repeats' : ''}`}
      date={expense.date}
      // The same columns as every expense list; it's always yours, so
      // nothing folds into the second line on narrow screens.
      cells={[
        { value: 'You', folded: null },
        { value: 'Just you', folded: null },
      ]}
      amount={formatMoney(expense.amountCents, expense.currency)}
      actions={
        <RowActions
          name={expense.description}
          edit={{
            dialog: (state) => <ExpenseDialog target={{ kind: 'personal', expense }} {...state} />,
          }}
          deleteDescription="You can restore it from Trash for 30 days."
          onDelete={() => removeExpense({ expenseId: expense.id })}
        />
      }
    />
  )
}
