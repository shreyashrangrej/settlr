'use client'

import { useEffect, useId, useState } from 'react'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { PiggyBank, Receipt, Tag, TrendingUp, Wallet } from 'lucide-react'

import { CategoryIcon } from '#/components/category'
import { ExpenseFilters, useListSearch } from '#/components/expense-filters'
import {
  ExpenseRow,
  ExpenseSection,
  ExpenseTable,
  RowActions,
} from '#/components/expense-list'
import {
  AmountInput,
  CategorySelect,
  CurrencySelect,
  DatePicker,
} from '#/components/form-fields'
import { useAction } from '#/components/ledger'
import { MonthNav } from '#/components/month-nav'
import { PageHeader, SplitLayout } from '#/components/page-header'
import {
  ReceiptField,
  ReceiptLink,
  existingReceipt,
  type ReceiptValue,
} from '#/components/receipts'
import { StatCard, StatGrid } from '#/components/stat-card'
import { Button, buttonVariants } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Progress, ProgressLabel, ProgressValue } from '#/components/ui/progress'
import { Spinner } from '#/components/ui/spinner'
import {
  categoryLabel,
  formatMoney,
  formatMonth,
  parseAmountToCents,
  todayIsoDate,
} from '@settlr/shared/format'
import { readPreferences } from '#/lib/preferences'
import {
  isFiltered,
  personalExpenseInput,
  personalSearchDefaults,
  type Category,
  type ExpenseFilter,
  type PersonalExpenseInput,
  type PersonalSearch,
  type Currency,
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
        title="Personal expenses"
        description="Spending that’s just yours, not split with anyone."
        actions={
          <>
            <Link
              href={month === thisMonth ? '/budget' : `/budget?month=${month}`}
              className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'no-underline')}
            >
              <PiggyBank />
              Monthly budget
            </Link>
            <MonthNav to="/personal" month={month} thisMonth={thisMonth} />
          </>
        }
      />

      <SplitLayout
        aside={
          <>
            <AddExpense month={month} />
            <ByCategory data={data} />
          </>
        }
      >
        <MonthStats data={data} />

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
          <ExpenseTable>
            {items.map((expense) => (
              <PersonalExpenseRow key={expense.id} expense={expense} />
            ))}
          </ExpenseTable>
        </ExpenseSection>
      </SplitLayout>
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

type PersonalExpense = PersonalMonth['items'][number]

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
  const removeExpense = useConvexMutation(api.personal.remove)
  const { run } = useAction(removeExpense, { success: 'Deleted', toastErrors: true })

  return (
    <ExpenseRow
      icon={<CategoryIcon category={expense.category} />}
      title={expense.description}
      receipt={expense.receiptId && <ReceiptLink source="personal" expenseId={expense.id} />}
      subtitle={categoryLabel(expense.category)}
      date={expense.date}
      amount={formatMoney(expense.amountCents, expense.currency)}
      actions={
        <RowActions
          name={expense.description}
          edit={{
            title: 'Edit expense',
            form: (close) => <ExpenseForm expense={expense} onSaved={close} />,
          }}
          onDelete={async () => Boolean(await run({ expenseId: expense.id }))}
        />
      }
    />
  )
}

function AddExpense({ month }: { month: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="size-4 text-primary" aria-hidden="true" />
          Add an expense
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ExpenseForm month={month} />
      </CardContent>
    </Card>
  )
}

/**
 * Adds a personal expense, or with `expense`, edits it. `month` is the month
 * on screen, so a new expense saved to another month can say where it went.
 */
function ExpenseForm({
  expense,
  month,
  onSaved,
}: {
  expense?: PersonalExpense
  month?: string
  onSaved?: () => void
}) {
  const id = useId()
  const addExpense = useConvexMutation(api.personal.add)
  const updateExpense = useConvexMutation(api.personal.update)
  const [savedTo, setSavedTo] = useState<string | null>(null)
  const { run, pending, error, setError } = useAction(
    async (input: PersonalExpenseInput, receipt: ReceiptValue) =>
      expense
        ? updateExpense({ expenseId: expense.id, ...input, receiptId: receipt?.id ?? null })
        : addExpense({ ...input, receiptId: receipt?.id }),
    { success: expense ? 'Expense updated' : 'Expense added' },
  )
  const [description, setDescription] = useState(expense?.description ?? '')
  const [amount, setAmount] = useState(
    expense ? (expense.amountCents / 100).toFixed(2) : '',
  )
  const [currency, setCurrency] = useState<Currency>(expense?.currency ?? 'USD')
  const [category, setCategory] = useState<Category>(expense?.category ?? 'food')
  const [date, setDate] = useState(expense?.date ?? todayIsoDate)
  const [receipt, setReceipt] = useState<ReceiptValue>(() => existingReceipt(expense?.receiptId))

  // Browser preferences only exist after hydration.
  useEffect(() => {
    if (!expense) setCurrency(readPreferences().defaultCurrency)
  }, [expense])

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const amountCents = parseAmountToCents(amount)
    if (amountCents === null) {
      setError('Enter an amount like 12.50')
      return
    }
    const parsed = personalExpenseInput.safeParse({
      description,
      amountCents,
      currency,
      category,
      date,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form')
      return
    }
    if (!(await run(parsed.data, receipt))) return
    if (expense) {
      onSaved?.()
      return
    }
    setDescription('')
    setAmount('')
    setReceipt(null)
    // Say where it went if it's not in the month on screen.
    const expenseMonth = parsed.data.date.slice(0, 7)
    setSavedTo(expenseMonth === month ? null : formatMonth(expenseMonth))
  }

  return (
    <form noValidate onSubmit={onSubmit}>
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor={`${id}-description`}>Description</FieldLabel>
          <Input
            id={`${id}-description`}
            value={description}
            maxLength={80}
            placeholder="Groceries"
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-[1fr_6.5rem] gap-3">
          <Field>
            <FieldLabel htmlFor={`${id}-amount`}>Amount</FieldLabel>
            <AmountInput id={`${id}-amount`} value={amount} onChange={setAmount} currency={currency} />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-currency`}>Currency</FieldLabel>
            <CurrencySelect id={`${id}-currency`} value={currency} onChange={setCurrency} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor={`${id}-category`}>Category</FieldLabel>
            <CategorySelect id={`${id}-category`} value={category} onChange={setCategory} />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-date`}>Date</FieldLabel>
            <DatePicker id={`${id}-date`} value={date} onChange={setDate} />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor={`${id}-receipt`}>Receipt</FieldLabel>
          <ReceiptField id={`${id}-receipt`} value={receipt} onChange={setReceipt} />
        </Field>
        {error && <FieldError>{error}</FieldError>}
        {savedTo && (
          <p className="text-sm text-positive" role="status">
            Saved to {savedTo}.
          </p>
        )}
        <Button type="submit" size="lg" disabled={pending}>
          {pending && <Spinner />}
          {expense ? 'Save changes' : 'Add expense'}
        </Button>
      </FieldGroup>
    </form>
  )
}
