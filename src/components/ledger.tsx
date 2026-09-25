import { useState } from 'react'

import { errorMessage } from '#/lib/errors'
import { formatMoney } from '#/lib/format'
import type { Currency } from '#/lib/schemas'
import { cn } from '#/lib/utils'

// Small pieces shared by the friends, groups and personal pages.

/** Runs a mutation with pending and error state for a form or button. */
export function useAction<Args extends Array<unknown>, Result>(
  action: (...args: Args) => Promise<Result>,
) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Resolves to the action's result, or null if it failed (the error is
  // then in `error`).
  async function run(...args: Args): Promise<{ value: Result } | null> {
    setPending(true)
    setError(null)
    try {
      return { value: await action(...args) }
    } catch (err) {
      setError(errorMessage(err))
      return null
    } finally {
      setPending(false)
    }
  }

  return { run, pending, error, setError }
}

/** An amount coloured by direction: positive is owed to you. */
export function SignedAmount({
  cents,
  currency,
  className,
}: {
  cents: number
  currency: Currency
  className?: string
}) {
  return (
    <span
      className={cn(
        'amount',
        cents > 0 ? 'positive' : cents < 0 ? 'negative' : 'muted',
        className,
      )}
    >
      {cents > 0 ? '+' : ''}
      {formatMoney(cents, currency)}
    </span>
  )
}

/** "owes you $12.00" / "you owe $4.50" / "settled up", per currency. */
export function BalanceText({
  balances,
  them = 'They',
}: {
  balances: Partial<Record<string, number>>
  them?: string
}) {
  const entries = Object.entries(balances).filter(
    (entry): entry is [string, number] => Boolean(entry[1]),
  )
  if (entries.length === 0) return <span className="muted">Settled up</span>
  return (
    <span className="grid justify-items-end gap-0.5">
      {entries.map(([currency, cents]) => (
        <span key={currency} className={cents > 0 ? 'positive' : 'negative'}>
          {cents > 0 ? `${them} owe${them === 'They' ? '' : 's'} you ` : 'You owe '}
          <span className="amount">
            {formatMoney(Math.abs(cents), currency as Currency)}
          </span>
        </span>
      ))}
    </span>
  )
}

export function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary uppercase"
    >
      {name.charAt(0)}
    </span>
  )
}

export function FormError({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <p className="form-error" role="alert">
      {error}
    </p>
  )
}

/** Totals per currency, e.g. the sum of what all friends owe you. */
export function sumBalances(list: Array<Partial<Record<string, number>>>) {
  const owed: Record<string, number> = {}
  const owe: Record<string, number> = {}
  for (const balances of list) {
    for (const [currency, cents] of Object.entries(balances)) {
      if (!cents) continue
      const bucket = cents > 0 ? owed : owe
      bucket[currency] = (bucket[currency] ?? 0) + Math.abs(cents)
    }
  }
  return { owed, owe }
}
