import type { Doc } from '../_generated/dataModel'

// Balance math. Everything is integer cents.

type FriendEntry = Pick<
  Doc<'friendEntries'>,
  'kind' | 'amountCents' | 'paidBy'
> & { split?: 'equal' | 'full' }

/**
 * How much an entry changes what the friend owes you (positive: they owe
 * you more). On an equal split the payer absorbs an odd cent.
 */
export function friendDelta(entry: FriendEntry) {
  const owedByOther =
    entry.kind === 'expense' && entry.split === 'equal'
      ? Math.floor(entry.amountCents / 2)
      : entry.amountCents
  return entry.paidBy === 'me' ? owedByOther : -owedByOther
}

/**
 * Your own share of a one-on-one expense (what it cost you): the non-payer
 * owes half rounded down on an equal split, or everything when owed in full.
 */
export function myFriendShare(entry: {
  amountCents: number
  paidBy: 'me' | 'friend'
  split: 'equal' | 'full'
}) {
  const otherOwes =
    entry.split === 'equal' ? Math.floor(entry.amountCents / 2) : entry.amountCents
  return entry.paidBy === 'me'
    ? entry.amountCents - otherOwes
    : entry.split === 'equal'
      ? Math.floor(entry.amountCents / 2)
      : entry.amountCents
}

export function addToBalance(
  balances: Record<string, number>,
  currency: string,
  cents: number,
) {
  const next = { ...balances, [currency]: (balances[currency] ?? 0) + cents }
  if (next[currency] === 0) delete next[currency]
  return next
}

type Group = Doc<'groups'>
type GroupExpense = Pick<
  Doc<'groupExpenses'>,
  'amountCents' | 'paidBy' | 'splitAmong' | 'category' | 'date'
>

/**
 * Splits an amount equally in integer cents. Leftover cents go to the first
 * participants (in group member order) so shares always sum to the total.
 */
export function shares(
  expense: Pick<GroupExpense, 'amountCents' | 'splitAmong'>,
  memberOrder: Array<string>,
) {
  const participants = [...expense.splitAmong].sort(
    (a, b) => memberOrder.indexOf(a) - memberOrder.indexOf(b),
  )
  const base = Math.floor(expense.amountCents / participants.length)
  const remainder = expense.amountCents - base * participants.length
  return new Map(
    participants.map((memberId, i) => [
      memberId,
      base + (i < remainder ? 1 : 0),
    ]),
  )
}

/**
 * The group's running totals after adding (`sign` 1) or removing (`sign`
 * -1) an expense. Callers patch the result onto the group in the same
 * mutation that inserts or deletes the expense.
 */
export function applyGroupExpense(
  group: Group,
  expense: GroupExpense,
  sign: 1 | -1,
) {
  const order = group.members.map((m) => m.id)
  const owed = shares(expense, order)
  const month = expense.date.slice(0, 7)
  return {
    members: group.members.map((m) => ({
      ...m,
      paidCents:
        m.paidCents + (m.id === expense.paidBy ? sign * expense.amountCents : 0),
      owedCents: m.owedCents + sign * (owed.get(m.id) ?? 0),
    })),
    expenseCount: group.expenseCount + sign,
    totalCents: group.totalCents + sign * expense.amountCents,
    byCategory: addToBalance(
      group.byCategory,
      expense.category,
      sign * expense.amountCents,
    ),
    byMonth: addToBalance(group.byMonth, month, sign * expense.amountCents),
  }
}

type MemberTotals = { paidCents: number; owedCents: number; settledCents?: number }

/**
 * Where a member stands in their group: what they paid minus their share of
 * the expenses, plus the settle-up payments they made less those they got.
 * Positive: the others owe them.
 */
export function memberNet(member: MemberTotals) {
  return member.paidCents - member.owedCents + (member.settledCents ?? 0)
}

/**
 * The group's members after recording (`sign` 1) or deleting (`sign` -1) a
 * settle-up payment: the payer's balance goes up, the recipient's down.
 */
export function applyGroupPayment(
  group: Group,
  payment: Pick<Doc<'groupPayments'>, 'from' | 'to' | 'amountCents'>,
  sign: 1 | -1,
) {
  const change = (memberId: string) =>
    memberId === payment.from
      ? sign * payment.amountCents
      : memberId === payment.to
        ? -sign * payment.amountCents
        : 0
  return {
    members: group.members.map((m) => {
      const delta = change(m.id)
      return delta === 0 ? m : { ...m, settledCents: (m.settledCents ?? 0) + delta }
    }),
  }
}

export type Settlement = { from: string; to: string; amountCents: number }

/**
 * Greedy settle-up: repeatedly match the biggest debtor with the biggest
 * creditor. Produces at most n - 1 transfers.
 */
export function settleUp(members: Array<MemberTotals & { id: string }>) {
  const net = members.map((m) => ({ id: m.id, cents: memberNet(m) }))
  const creditors = net.filter((b) => b.cents > 0)
  const debtors = net
    .filter((b) => b.cents < 0)
    .map((b) => ({ id: b.id, cents: -b.cents }))
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
  return settlements
}
