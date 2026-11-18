'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import { hashIndex, labelTint } from '#/components/category'
import { Avatar, AvatarFallback } from '#/components/ui/avatar'
import { Badge } from '#/components/ui/badge'
import { errorMessage } from '#/lib/errors'
import { formatMoney } from '@settlr/shared/format'
import type { Currency } from '@settlr/shared/schemas'
import { cn } from '#/lib/utils'

// Small pieces shared by the friends, groups and personal pages.

/**
 * Runs a mutation with pending and error state for a form or button. On
 * success it shows `success` as a toast. On failure the message is in
 * `error` for a form to show next to its fields, or, with `toastErrors`
 * (for buttons and dialogs that have nowhere to show it), a toast.
 */
export function useAction<Args extends Array<unknown>, Result>(
  action: (...args: Args) => Promise<Result>,
  { success, toastErrors }: { success?: string; toastErrors?: boolean } = {},
) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Resolves to the action's result, or null if it failed.
  async function run(...args: Args): Promise<{ value: Result } | null> {
    setPending(true)
    setError(null)
    try {
      const value = await action(...args)
      if (success) toast.success(success)
      return { value }
    } catch (err) {
      const message = errorMessage(err)
      setError(message)
      if (toastErrors) toast.error(message)
      return null
    } finally {
      setPending(false)
    }
  }

  return { run, pending, error, setError }
}

/**
 * An amount coloured by direction: blue is owed to you, orange is what you
 * owe. The sign is always shown too, so it never relies on colour alone.
 */
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
        'font-medium whitespace-nowrap tabular-nums',
        cents > 0 ? 'text-positive' : cents < 0 ? 'text-destructive' : 'text-muted-foreground',
        className,
      )}
    >
      {cents > 0 ? '+' : cents < 0 ? '−' : ''}
      {formatMoney(Math.abs(cents), currency)}
    </span>
  )
}

/** "They owe you $12.00" / "You owe $4.50" / "Settled up", per currency. */
export function BalanceText({
  balances,
  them = 'They',
  className,
}: {
  balances: Partial<Record<string, number>>
  them?: string
  className?: string
}) {
  const entries = Object.entries(balances).filter(
    (entry): entry is [string, number] => Boolean(entry[1]),
  )
  if (entries.length === 0) {
    return <span className={cn('text-muted-foreground', className)}>Settled up</span>
  }
  return (
    <span className={cn('grid justify-items-end gap-0.5', className)}>
      {entries.map(([currency, cents]) => (
        <span key={currency} className="text-muted-foreground">
          {cents > 0 ? `${them} owe${them === 'They' ? '' : 's'} you ` : 'You owe '}
          <span
            className={cn(
              'font-medium tabular-nums',
              cents > 0 ? 'text-positive' : 'text-destructive',
            )}
          >
            {formatMoney(Math.abs(cents), currency as Currency)}
          </span>
        </span>
      ))}
    </span>
  )
}

// Avatar hues, picked from the name so a person keeps their colour. They're
// drawn as T3 Code's label tint (see `labelTint`), so they suit both themes.
const AVATAR_HUES = ['#60A5FA', '#FBBF24', '#34D399', '#FB7185', '#A78BFA']

export function PersonAvatar({
  name,
  size = 'default',
  me = false,
  className,
}: {
  name: string
  size?: 'default' | 'sm' | 'lg'
  /** The signed-in user, who gets the brand colour. */
  me?: boolean
  className?: string
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
  return (
    <Avatar size={size} className={className}>
      <AvatarFallback
        className={cn('uppercase', me ? 'bg-primary text-primary-foreground' : '')}
        style={me ? undefined : labelTint(AVATAR_HUES[hashIndex(name, AVATAR_HUES.length)])}
      >
        {initials || '?'}
      </AvatarFallback>
    </Avatar>
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

/** Whether a friend is connected on Settlr, or has a request out. */
export function FriendStatusBadge({
  status,
}: {
  status: 'linked' | 'pending' | 'declined' | null
}) {
  if (status === 'linked') return <Badge>On Settlr</Badge>
  if (status === 'pending') return <Badge variant="secondary">Request sent</Badge>
  if (status === 'declined') return <Badge variant="outline">Request declined</Badge>
  return null
}
