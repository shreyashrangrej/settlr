import { useEffect, useState } from 'react'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Trash2, Wallet } from 'lucide-react'

import {
  CategorySelect,
  CurrencySelect,
  Field,
} from '#/components/form-fields'
import { FormError, useAction } from '#/components/ledger'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
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
      <div className="page-header">
        <div>
          <h1>Personal expenses</h1>
          <p className="muted">Spending that’s just yours, not split with anyone.</p>
        </div>
        <nav className="flex items-center gap-1" aria-label="Month">
          <MonthLink month={shiftMonth(month, -1)} thisMonth={thisMonth} label="Previous month">
            <ChevronLeft />
          </MonthLink>
          <span className="min-w-36 text-center font-semibold">
            {formatMonth(month)}
          </span>
          <MonthLink month={shiftMonth(month, 1)} thisMonth={thisMonth} label="Next month">
            <ChevronRight />
          </MonthLink>
        </nav>
      </div>

      <div className="group-layout">
        <section aria-label={`Spending in ${formatMonth(month)}`} className="grid gap-4">
          <Totals data={data} />

          {data.items.length === 0 ? (
            <p className="empty">No personal expenses in {formatMonth(month)}.</p>
          ) : (
            <ul className="expense-list">
              {data.items.map((expense) => (
                <ExpenseRow key={expense.id} expense={expense} />
              ))}
            </ul>
          )}
          {data.truncated && (
            <p className="muted text-sm">
              Showing the first {data.items.length} expenses of this month.
            </p>
          )}

          {data.byCategory.length > 0 && <ByCategory data={data} />}
        </section>

        <AddExpense month={month} />
      </div>
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
    <Button asChild variant="ghost" size="icon" aria-label={label} title={label}>
      <Link
        from={Route.fullPath}
        search={{ month: month === thisMonth ? '' : month }}
      >
        {children}
      </Link>
    </Button>
  )
}

function Totals({ data }: { data: PersonalMonth }) {
  return (
    <div className="card">
      <p className="muted">Spent in {formatMonth(data.month)}</p>
      <p className="card__stat">
        {data.totals.length === 0
          ? formatMoney(0, 'USD')
          : data.totals
              .map((t) => formatMoney(t.cents, t.currency))
              .join(' + ')}
      </p>
      <p className="muted text-sm">
        {data.items.length} expense{data.items.length === 1 ? '' : 's'}
      </p>
    </div>
  )
}

function ByCategory({ data }: { data: PersonalMonth }) {
  const max = Math.max(...data.byCategory.map((r) => r.cents), 1)
  return (
    <section className="card">
      <h2>By category</h2>
      <ul className="bar-list">
        {data.byCategory.map((row) => (
          <li key={`${row.currency}:${row.category}`}>
            <div className="bar-list__label">
              <span>{categoryLabel(row.category)}</span>
              <span className="amount">{formatMoney(row.cents, row.currency)}</span>
            </div>
            <div className="bar" aria-hidden="true">
              <span style={{ width: `${(row.cents / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ExpenseRow({ expense }: { expense: PersonalMonth['items'][number] }) {
  const removeExpense = useConvexMutation(api.personal.remove)
  const { run, pending } = useAction(removeExpense)

  return (
    <li className="expense">
      <div className="min-w-0">
        <p className="expense__title truncate">{expense.description}</p>
        <p className="muted">
          {formatDate(expense.date)} · {categoryLabel(expense.category)}
        </p>
      </div>
      <div className="expense__side">
        <span className="amount">
          {formatMoney(expense.amountCents, expense.currency)}
        </span>
        <button
          type="button"
          className="button button--ghost"
          disabled={pending}
          aria-label={`Delete ${expense.description}`}
          onClick={() => {
            if (window.confirm(`Delete “${expense.description}”?`)) {
              void run({ expenseId: expense.id })
            }
          }}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </li>
  )
}

function AddExpense({ month }: { month: string }) {
  const addExpense = useConvexMutation(api.personal.add)
  const { run, pending, error, setError } = useAction(addExpense)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<Currency>('USD')
  const [category, setCategory] = useState<Category>('food')
  const [date, setDate] = useState(todayIsoDate)
  const [savedTo, setSavedTo] = useState<string | null>(null)

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
    <aside className="card" aria-labelledby="add-personal-heading">
      <form noValidate onSubmit={onSubmit} className="grid gap-3">
        <h2 id="add-personal-heading" className="m-0 flex items-center gap-2">
          <Wallet className="size-4 text-primary" aria-hidden="true" />
          Add an expense
        </h2>
        <Field label="Description" htmlFor="pe-description">
          <Input
            id="pe-description"
            value={description}
            maxLength={80}
            placeholder="Groceries"
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-[1fr_6rem] gap-2">
          <Field label="Amount" htmlFor="pe-amount">
            <Input
              id="pe-amount"
              inputMode="decimal"
              value={amount}
              placeholder="0.00"
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="Currency" htmlFor="pe-currency">
            <CurrencySelect id="pe-currency" value={currency} onChange={setCurrency} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Category" htmlFor="pe-category">
            <CategorySelect id="pe-category" value={category} onChange={setCategory} />
          </Field>
          <Field label="Date" htmlFor="pe-date">
            <Input
              id="pe-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        </div>
        <FormError error={error} />
        {savedTo && (
          <p className="positive text-sm" role="status">
            Saved to {savedTo}.
          </p>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Add expense'}
        </Button>
      </form>
    </aside>
  )
}
