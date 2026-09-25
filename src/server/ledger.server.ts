import type {
  Expense,
  Group,
  GroupBalances,
  GroupInsights,
  MemberBalance,
  Settlement,
} from '#/lib/types'
import type { Category } from '#/lib/schemas'

/**
 * Splits an amount equally in integer cents. Leftover cents go to the first
 * participants (in group member order) so shares always sum to the total.
 */
function shares(expense: Expense, memberOrder: Array<string>) {
  const participants = [...expense.splitAmong].sort(
    (a, b) => memberOrder.indexOf(a) - memberOrder.indexOf(b),
  )
  const base = Math.floor(expense.amountCents / participants.length)
  const remainder = expense.amountCents - base * participants.length
  return participants.map((memberId, i) => ({
    memberId,
    cents: base + (i < remainder ? 1 : 0),
  }))
}

function memberTotals(group: Group, expenses: Array<Expense>) {
  const order = group.members.map((m) => m.id)
  const totals = new Map(
    order.map((id) => [id, { paidCents: 0, owedCents: 0 }]),
  )
  const totalsFor = (id: string) => {
    let t = totals.get(id)
    if (!t) {
      t = { paidCents: 0, owedCents: 0 }
      totals.set(id, t)
    }
    return t
  }
  for (const expense of expenses) {
    totalsFor(expense.paidBy).paidCents += expense.amountCents
    for (const share of shares(expense, order)) {
      totalsFor(share.memberId).owedCents += share.cents
    }
  }
  return totals
}

export function computeBalances(
  group: Group,
  expenses: Array<Expense>,
): GroupBalances {
  const balances: Array<MemberBalance> = [
    ...memberTotals(group, expenses),
  ].map(([memberId, t]) => ({
    memberId,
    ...t,
    netCents: t.paidCents - t.owedCents,
  }))

  // Greedy settle-up: repeatedly match the biggest debtor with the biggest
  // creditor. Produces at most n - 1 transfers.
  const creditors = balances
    .filter((b) => b.netCents > 0)
    .map((b) => ({ id: b.memberId, cents: b.netCents }))
  const debtors = balances
    .filter((b) => b.netCents < 0)
    .map((b) => ({ id: b.memberId, cents: -b.netCents }))
  const settlements: Array<Settlement> = []

  while (creditors.length && debtors.length) {
    creditors.sort((a, b) => b.cents - a.cents)
    debtors.sort((a, b) => b.cents - a.cents)
    const creditor = creditors[0]
    const debtor = debtors[0]
    const amount = Math.min(creditor.cents, debtor.cents)
    settlements.push({ from: debtor.id, to: creditor.id, amountCents: amount })
    creditor.cents -= amount
    debtor.cents -= amount
    if (creditor.cents === 0) creditors.shift()
    if (debtor.cents === 0) debtors.shift()
  }

  return { balances, settlements }
}

export function computeInsights(
  group: Group,
  expenses: Array<Expense>,
): GroupInsights {
  const byCategory = new Map<Category, number>()
  const byMonth = new Map<string, number>()
  let totalCents = 0
  let lastExpenseAt: string | null = null

  for (const e of expenses) {
    totalCents += e.amountCents
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amountCents)
    const month = e.date.slice(0, 7)
    byMonth.set(month, (byMonth.get(month) ?? 0) + e.amountCents)
    if (!lastExpenseAt || e.createdAt > lastExpenseAt) lastExpenseAt = e.createdAt
  }

  return {
    totalCents,
    byCategory: [...byCategory]
      .map(([category, cents]) => ({ category, cents }))
      .sort((a, b) => b.cents - a.cents),
    byMember: [...memberTotals(group, expenses)].map(([memberId, t]) => ({
      memberId,
      ...t,
    })),
    byMonth: [...byMonth]
      .map(([month, cents]) => ({ month, cents }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    lastExpenseAt,
  }
}
