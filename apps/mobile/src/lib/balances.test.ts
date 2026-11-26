import { describe, expect, it } from 'vitest'

import { balanceRows, mainCurrency, netByCurrency, stanceLabel, totals, type FriendSummary, type GroupSummary } from './balances'

const friend = (id: string, balances: Record<string, number>): FriendSummary => ({
  id,
  name: id,
  balances,
  lastActivityAt: 0,
  status: null,
})

const group = (id: string, myNetCents: number, extra: Partial<GroupSummary> = {}): GroupSummary => ({
  id,
  name: id,
  currency: 'INR',
  memberCount: 3,
  expenseCount: 1,
  totalCents: 0,
  myNetCents,
  archived: false,
  ...extra,
})

describe('balances on Home', () => {
  it('lists every open friend balance per currency and every group you are not square in, biggest first', () => {
    const rows = balanceRows(
      [friend('rohan', { INR: 214000, USD: 4200 }), friend('kabir', { INR: 0 })],
      [group('goa', 341000), group('flat', -89000), group('square', 0)],
    )
    expect(rows.map((r) => r.key)).toEqual(['g:goa', 'f:rohan:INR', 'g:flat', 'f:rohan:USD'])
  })

  it('leaves archived groups out', () => {
    expect(balanceRows([], [group('old', 5000, { archived: true })])).toEqual([])
  })

  it('adds up what you are owed and what you owe per currency', () => {
    const rows = balanceRows([friend('rohan', { INR: 214000 }), friend('ananya', { INR: -164000 })], [group('goa', 341000), group('flat', -89000)])
    const sums = totals(rows)
    expect(sums.owed).toEqual({ INR: 555000 })
    expect(sums.owe).toEqual({ INR: 253000 })
    expect(netByCurrency(sums)).toEqual({ INR: 302000 })
  })

  it('shows the currency most of your balances are in', () => {
    const sums = totals([
      { cents: 4200, currency: 'USD' },
      { cents: -500000, currency: 'INR' },
    ])
    expect(mainCurrency(sums, 'EUR')).toBe('INR')
    expect(mainCurrency(totals([]), 'EUR')).toBe('EUR')
  })

  it('says it in words, from your side', () => {
    expect(stanceLabel(100, 'friend')).toBe('owes you')
    expect(stanceLabel(-100, 'friend')).toBe('you owe')
    expect(stanceLabel(100, 'group')).toBe('you’re owed')
    expect(stanceLabel(0, 'group')).toBe('settled')
  })
})
