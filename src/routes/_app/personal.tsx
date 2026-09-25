import { useEffect, useState } from 'react'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Trash2, Wallet } from 'lucide-react'

import { ConfirmAction } from '#/components/confirm-action'
import { AmountInput, CategorySelect, CurrencySelect } from '#/components/form-fields'
import { useAction } from '#/components/ledger'
import { PageHeader, SplitLayout } from '#/components/page-header'
import { Badge } from '#/components/ui/badge'
import { Button, buttonVariants } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '#/components/ui/empty'
import { Field, FieldError, FieldGroup, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '#/components/ui/item'
import { Progress, ProgressLabel, ProgressValue } from '#/components/ui/progress'
import { Spinner } from '#/components/ui/spinner'
import {
  categoryLabel,
  currentMonth,
  formatDate,
  formatMoney,
  formatMonth,
  parseAmountToCents,
  shiftMonth,
  todayIsoDate,
} from '#/lib/format'
import { readPreferences } from '#/lib/preferences'
import {
  personalExpenseInput,
  personalSearchDefaults,
  personalSearchSchema,
  type Category,
  type Currency,
} from '#/lib/schemas'
import type { PersonalMonth } from '#/lib/types'
import { cn } from '#/lib/utils'
import { api } from '#convex/_generated/api'

// SSR: full. Your own spending, one month at a time (`?month=2026-09`; no
// param means this month). The loader resolves "this month" once, on the
// server during SSR, and the component reads it from loader data so the
// server and client render the same month.
export const Route = createFileRoute('/_app/personal')({
  validateSearch: personalSearchSchema,
  search: { middlewares: [stripSearchParams(personalSearchDefaults)] },
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    const month = deps.month || currentMonth()
    await context.queryClient.ensureQueryData(
      convexQuery(api.personal.month, { month }),
    )
    return { month, thisMonth: currentMonth() }
  },
  head: () => ({ meta: [{ title: 'Personal expenses · Settlr' }] }),
  component: PersonalPage,
})

function PersonalPage() {
  const { month, thisMonth } = Route.useLoaderData()
  const { data } = useSuspenseQuery(convexQuery(api.personal.month, { month }))

  return (
    <>
      <PageHeader
        title="Personal expenses"
        description="Spending that’s just yours, not split with anyone."
        actions={
          <nav className="flex items-center gap-1 rounded-lg border p-1" aria-label="Month">
            <MonthLink month={shiftMonth(month, -1)} thisMonth={thisMonth} label="Previous month">
              <ChevronLeft />
            </MonthLink>
            <span className="min-w-36 text-center text-sm font-semibold">
              {formatMonth(month)}
            </span>
            <MonthLink month={shiftMonth(month, 1)} thisMonth={thisMonth} label="Next month">
              <ChevronRight />
            </MonthLink>
          </nav>
        }
      />

      <SplitLayout aside={<AddExpense month={month} />}>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardDescription>Spent in {formatMonth(data.month)}</CardDescription>
              <CardTitle className="text-3xl font-bold tabular-nums">
                {data.totals.length === 0
                  ? '—'
                  : data.totals.map((t) => formatMoney(t.cents, t.currency)).join(' + ')}
              </CardTitle>
              <CardDescription>
                {data.items.length} expense{data.items.length === 1 ? '' : 's'}
              </CardDescription>
            </CardHeader>
          </Card>
          <ByCategory data={data} />
        </div>

        <Card className="py-2">
          <CardContent className="px-2">
            {data.items.length === 0 ? (
              <Empty className="py-10">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Wallet />
                  </EmptyMedia>
                  <EmptyTitle>No expenses in {formatMonth(month)}</EmptyTitle>
                  <EmptyDescription>
                    Log what you spend to see where it goes.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ItemGroup>
                {data.items.map((expense) => (
                  <ExpenseRow key={expense.id} expense={expense} />
                ))}
              </ItemGroup>
            )}
          </CardContent>
        </Card>
        {data.truncated && (
          <p className="text-sm text-muted-foreground">
            Showing the first {data.items.length} expenses of this month.
          </p>
        )}
      </SplitLayout>
    </>
  )
}

function MonthLink({
  month,
  thisMonth,
  label,
  children,
}: {
  month: string
  thisMonth: string
  label: string
  children: React.ReactNode
}) {
  return (
    <Link
      from={Route.fullPath}
      search={{ month: month === thisMonth ? '' : month }}
      aria-label={label}
      title={label}
      className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
    >
      {children}
    </Link>
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
          data.byCategory.slice(0, 5).map((row) => (
            <Progress key={`${row.currency}:${row.category}`} value={(row.cents / max) * 100}>
              <ProgressLabel className="text-sm">{categoryLabel(row.category)}</ProgressLabel>
              <ProgressValue className="ml-auto text-sm font-semibold tabular-nums">
                {() => formatMoney(row.cents, row.currency)}
              </ProgressValue>
            </Progress>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function ExpenseRow({ expense }: { expense: PersonalMonth['items'][number] }) {
  const removeExpense = useConvexMutation(api.personal.remove)
  const { run } = useAction(removeExpense, { success: 'Deleted', toastErrors: true })

  return (
    <Item>
      <ItemContent>
        <ItemTitle>
          {expense.description}
          <Badge variant="secondary">{categoryLabel(expense.category)}</Badge>
        </ItemTitle>
        <ItemDescription>{formatDate(expense.date)}</ItemDescription>
      </ItemContent>
      <ItemActions>
        <span className="font-semibold tabular-nums">
          {formatMoney(expense.amountCents, expense.currency)}
        </span>
        <ConfirmAction
          title={`Delete “${expense.description}”?`}
          description="This can’t be undone."
          onConfirm={async () => Boolean(await run({ expenseId: expense.id }))}
          trigger={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete ${expense.description}`}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 />
            </Button>
          }
        />
      </ItemActions>
    </Item>
  )
}

function AddExpense({ month }: { month: string }) {
  const addExpense = useConvexMutation(api.personal.add)
  const [savedTo, setSavedTo] = useState<string | null>(null)
  const { run, pending, error, setError } = useAction(addExpense, {
    success: 'Expense added',
  })
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<Currency>('USD')
  const [category, setCategory] = useState<Category>('food')
  const [date, setDate] = useState(todayIsoDate)

  // Browser preferences only exist after hydration.
  useEffect(() => setCurrency(readPreferences().defaultCurrency), [])

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
    if (await run(parsed.data)) {
      setDescription('')
      setAmount('')
      // Say where it went if it's not in the month on screen.
      const expenseMonth = parsed.data.date.slice(0, 7)
      setSavedTo(expenseMonth === month ? null : formatMonth(expenseMonth))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="size-4 text-primary" aria-hidden="true" />
          Add an expense
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form noValidate onSubmit={onSubmit}>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="pe-description">Description</FieldLabel>
              <Input
                id="pe-description"
                value={description}
                maxLength={80}
                placeholder="Groceries"
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-[1fr_6.5rem] gap-3">
              <Field>
                <FieldLabel htmlFor="pe-amount">Amount</FieldLabel>
                <AmountInput id="pe-amount" value={amount} onChange={setAmount} currency={currency} />
              </Field>
              <Field>
                <FieldLabel htmlFor="pe-currency">Currency</FieldLabel>
                <CurrencySelect id="pe-currency" value={currency} onChange={setCurrency} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="pe-category">Category</FieldLabel>
                <CategorySelect id="pe-category" value={category} onChange={setCategory} />
              </Field>
              <Field>
                <FieldLabel htmlFor="pe-date">Date</FieldLabel>
                <Input
                  id="pe-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
            </div>
            {error && <FieldError>{error}</FieldError>}
            {savedTo && (
              <p className={cn('text-sm text-positive')} role="status">
                Saved to {savedTo}.
              </p>
            )}
            <Button type="submit" size="lg" disabled={pending}>
              {pending && <Spinner />}
              Add expense
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
