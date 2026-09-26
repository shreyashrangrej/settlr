'use client'

import { useState } from 'react'
import { useConvexMutation } from '@convex-dev/react-query'
import { Pencil, PiggyBank, Plus } from 'lucide-react'

import { AmountInput, CurrencySelect } from '#/components/form-fields'
import { useAction } from '#/components/ledger'
import { Section } from '#/components/section'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '#/components/ui/field'
import { Spinner } from '#/components/ui/spinner'
import { formatMoney, parseAmountToCents } from '#/lib/format'
import { readPreferences } from '#/lib/preferences'
import type { Currency } from '#/lib/schemas'
import { cn } from '#/lib/utils'
import { api } from '#convex/_generated/api'

export type Budget = { currency: Currency; amountCents: number }

/** A month's spending in one currency (see budgets.monthSpending). */
export type Spending = {
  currency: Currency
  personal: number
  friends: number
  groups: number
  total: number
}

// How close spending is to a budget.
export function budgetStatus(spentCents: number, budgetCents: number) {
  const ratio = budgetCents > 0 ? spentCents / budgetCents : 0
  if (ratio > 1) return { ratio, tone: 'over', label: 'Over budget' } as const
  if (ratio >= 0.8) return { ratio, tone: 'warn', label: 'Almost there' } as const
  return { ratio, tone: 'ok', label: 'On track' } as const
}

/** A month's spending in `currency`, or zeros. */
export function spentIn(spending: Array<Spending>, currency: Currency): Spending {
  return (
    spending.find((s) => s.currency === currency) ?? {
      currency,
      personal: 0,
      friends: 0,
      groups: 0,
      total: 0,
    }
  )
}

const barTone = {
  ok: 'bg-primary',
  warn: 'bg-amber-500',
  over: 'bg-destructive',
} as const

const badgeTone = {
  ok: 'bg-positive/15 text-positive',
  warn: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  over: 'bg-destructive/15 text-destructive',
} as const

/**
 * The monthly budget(s) for `month`: everything you spent (personal, plus
 * your share with friends and in groups) against the budget, what's left,
 * and (for the current month) a daily allowance. `today` is a `YYYY-MM-DD`
 * date from the page (read on the server), so SSR and the client agree.
 */
export function BudgetSection({
  month,
  today,
  budgets,
  spending,
  defaultCurrency,
}: {
  month: string
  today: string
  budgets: Array<Budget>
  spending: Array<Spending>
  /** Where "Set budget" starts; falls back to the Settings default. */
  defaultCurrency?: Currency
}) {
  return (
    <Section
      title="Monthly budget"
      description={
        budgets.length === 0 &&
        'A limit for what you spend each month, including your share with friends and in groups.'
      }
      actions={
        budgets.length > 0 && (
          <BudgetDialog
            initialCurrency={defaultCurrency}
            budgets={budgets}
            trigger={
              <Button variant="ghost" size="sm">
                <Plus />
                Add currency
              </Button>
            }
          />
        )
      }
    >
      {budgets.length === 0 ? (
        <BudgetDialog
          initialCurrency={defaultCurrency}
          budgets={budgets}
          trigger={
            <Button variant="outline" className="justify-self-start">
              <PiggyBank />
              Set monthly budget
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6">
          {budgets.map((budget) => (
            <BudgetProgress
              key={budget.currency}
              budget={budget}
              spent={spentIn(spending, budget.currency)}
              month={month}
              today={today}
              budgets={budgets}
            />
          ))}
        </div>
      )}
    </Section>
  )
}

/**
 * How one budget is going this month. With `budgets` (all of them, for the
 * dialog) it has an Edit button.
 */
export function BudgetProgress({
  budget,
  spent,
  month,
  today,
  budgets,
}: {
  budget: Budget
  spent: Spending
  month: string
  today: string
  budgets?: Array<Budget>
}) {
  const spentCents = spent.total
  const status = budgetStatus(spentCents, budget.amountCents)
  const parts = (
    [
      ['Personal', spent.personal],
      ['Friends', spent.friends],
      ['Groups', spent.groups],
    ] as const
  ).filter(([, cents]) => cents > 0)
  const money = (cents: number) => formatMoney(cents, budget.currency)
  const left = budget.amountCents - spentCents

  // Only the current month has days left to spread the remainder over.
  let perDay: string | null = null
  if (month === today.slice(0, 7) && left > 0) {
    const [year, m, day] = today.split('-').map(Number)
    const daysInMonth = new Date(Date.UTC(year, m, 0)).getUTCDate()
    const daysLeft = daysInMonth - day + 1
    perDay = `${money(Math.floor(left / daysLeft))}/day for ${daysLeft} day${daysLeft === 1 ? '' : 's'}`
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', badgeTone[status.tone])}>
          {status.label}
        </span>
        {budgets && (
          <BudgetDialog
            initialCurrency={budget.currency}
            budgets={budgets}
            trigger={
              <Button
                variant="ghost"
                size="xs"
                className="text-muted-foreground"
                aria-label={`Edit ${budget.currency} budget`}
              >
                <Pencil />
                Edit
              </Button>
            }
          />
        )}
      </div>
      <p className="text-sm">
        <span className="text-xl font-bold tabular-nums">{money(spentCents)}</span>{' '}
        <span className="text-muted-foreground">of {money(budget.amountCents)}</span>
      </p>
      <div
        role="progressbar"
        aria-label={`${budget.currency} budget used`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.min(status.ratio, 1) * 100)}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-500', barTone[status.tone])}
          style={{ width: `${Math.min(status.ratio, 1) * 100}%` }}
        />
      </div>
      {parts.length > 1 && (
        <p className="text-xs text-muted-foreground">
          {parts.map(([label, cents]) => `${label} ${money(cents)}`).join(' · ')}
        </p>
      )}
      <p className="flex flex-wrap justify-between gap-x-3 text-xs text-muted-foreground">
        <span className={cn(left < 0 && 'font-medium text-destructive')}>
          {left >= 0 ? `${money(left)} left` : `${money(-left)} over`}
        </span>
        {perDay && <span>{perDay}</span>}
      </p>
    </div>
  )
}

/** Sets, changes or removes the monthly budget for a currency. */
export function BudgetDialog({
  trigger,
  initialCurrency,
  budgets,
}: {
  trigger: React.ReactElement
  initialCurrency?: Currency
  budgets: Array<Budget>
}) {
  const [open, setOpen] = useState(false)
  const [currency, setCurrency] = useState<Currency>(initialCurrency ?? 'USD')
  const [amount, setAmount] = useState('')
  const setBudget = useConvexMutation(api.budgets.set)
  const removeBudget = useConvexMutation(api.budgets.remove)
  const save = useAction(setBudget, { success: 'Budget saved' })
  const remove = useAction(removeBudget, { success: 'Budget removed', toastErrors: true })
  const existing = budgets.find((b) => b.currency === currency)

  // Opening (or switching currency) starts from that currency's budget.
  function pick(next: Currency) {
    setCurrency(next)
    const found = budgets.find((b) => b.currency === next)
    setAmount(found ? (found.amountCents / 100).toFixed(2) : '')
    save.setError(null)
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const amountCents = parseAmountToCents(amount)
    if (!amountCents) {
      save.setError('Enter an amount like 5000')
      return
    }
    if (await save.run({ currency, amountCents })) setOpen(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Preferences live in localStorage, so read them only on open.
        if (next) pick(initialCurrency ?? readPreferences().defaultCurrency)
        setOpen(next)
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent>
        <form noValidate onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{existing ? 'Edit monthly budget' : 'Set monthly budget'}</DialogTitle>
            <DialogDescription>
              A limit for what you spend each month: your personal expenses
              plus your share of expenses with friends and in groups.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-4">
            <div className="grid grid-cols-[1fr_6.5rem] gap-3">
              <Field>
                <FieldLabel htmlFor="budget-amount">Amount per month</FieldLabel>
                <AmountInput
                  id="budget-amount"
                  value={amount}
                  onChange={setAmount}
                  currency={currency}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="budget-currency">Currency</FieldLabel>
                <CurrencySelect id="budget-currency" value={currency} onChange={pick} />
              </Field>
            </div>
            {save.error && <FieldError>{save.error}</FieldError>}
          </FieldGroup>
          <DialogFooter className="gap-2 sm:justify-between">
            {existing ? (
              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                disabled={remove.pending}
                onClick={async () => {
                  if (await remove.run({ currency })) setOpen(false)
                }}
              >
                {remove.pending && <Spinner />}
                Remove budget
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <DialogClose render={<Button type="button" variant="outline" />}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={save.pending}>
                {save.pending && <Spinner />}
                Save budget
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
