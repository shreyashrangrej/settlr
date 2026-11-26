import type { Currency } from '@settlr/shared/schemas'

// Where you stand, from the friends and groups lists (the same sums as the
// web dashboard). Positive cents are owed to you.

export type FriendSummary = {
  id: string
  name: string
  balances: Record<string, number>
  lastActivityAt: number
  status: 'linked' | 'pending' | 'declined' | null
}

export type GroupSummary = {
  id: string
  name: string
  currency: Currency
  memberCount: number
  expenseCount: number
  totalCents: number
  myNetCents: number
  archived: boolean
}

export type BalanceRow = {
  key: string
  kind: 'friend' | 'group'
  id: string
  name: string
  cents: number
  currency: Currency
  /** Groups: how many people. */
  memberCount?: number
}

/** One row per friend and currency, and per group, you aren't square in; biggest first. */
export function balanceRows(friends: Array<FriendSummary>, groups: Array<GroupSummary>) {
  const rows: Array<BalanceRow> = []
  for (const friend of friends) {
    for (const [currency, cents] of Object.entries(friend.balances)) {
      if (!cents) continue
      rows.push({
        key: `f:${friend.id}:${currency}`,
        kind: 'friend',
        id: friend.id,
        name: friend.name,
        cents,
        currency: currency as Currency,
      })
    }
  }
  for (const group of groups) {
    if (!group.myNetCents || group.archived) continue
    rows.push({
      key: `g:${group.id}`,
      kind: 'group',
      id: group.id,
      name: group.name,
      cents: group.myNetCents,
      currency: group.currency,
      memberCount: group.memberCount,
    })
  }
  return rows.sort((a, b) => Math.abs(b.cents) - Math.abs(a.cents))
}

export type Totals = {
  /** Owed to you, per currency (positive). */
  owed: Partial<Record<Currency, number>>
  /** You owe, per currency (positive). */
  owe: Partial<Record<Currency, number>>
}

export function totals(rows: Array<{ cents: number; currency: Currency }>): Totals {
  const owed: Totals['owed'] = {}
  const owe: Totals['owe'] = {}
  for (const row of rows) {
    if (row.cents > 0) owed[row.currency] = (owed[row.currency] ?? 0) + row.cents
    if (row.cents < 0) owe[row.currency] = (owe[row.currency] ?? 0) - row.cents
  }
  return { owed, owe }
}

/** The currency most of your balances are in, or `fallback` with none. */
export function mainCurrency(t: Totals, fallback: Currency): Currency {
  const currencies = [...new Set([...Object.keys(t.owed), ...Object.keys(t.owe)])] as Array<Currency>
  const weight = (c: Currency) => (t.owed[c] ?? 0) + (t.owe[c] ?? 0)
  return currencies.sort((a, b) => weight(b) - weight(a))[0] ?? fallback
}

/** Net per currency (owed minus owe), leaving out zeros. */
export function netByCurrency(t: Totals) {
  const out: Partial<Record<Currency, number>> = {}
  for (const c of new Set([...Object.keys(t.owed), ...Object.keys(t.owe)]) as Set<Currency>) {
    const net = (t.owed[c] ?? 0) - (t.owe[c] ?? 0)
    if (net !== 0) out[c] = net
  }
  return out
}

/** "you’re owed" / "you owe" / "settled" for a balance from your side. */
export function stanceLabel(cents: number, kind: 'friend' | 'group') {
  if (cents === 0) return 'settled'
  if (kind === 'group') return cents > 0 ? 'you’re owed' : 'you owe'
  return cents > 0 ? 'owes you' : 'you owe'
}
