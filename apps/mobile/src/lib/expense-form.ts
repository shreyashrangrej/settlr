import type { Category, Currency } from '@settlr/shared/schemas'
import { computeSplit, equalSplit, splitProblem } from '@settlr/shared/split'

// The Add expense screen's split state and what it sends to Convex, kept
// free of React so the rules are tested on their own (expense-form.test.ts).

export type GroupMode = 'equal' | 'exact' | 'percent' | 'shares'

export type GroupSplit = {
  payer: string
  mode: GroupMode
  /** Equally: who shares it. */
  included: Array<string>
  /** Amounts: cents; %: basis points (1% = 100); Shares: counts. */
  inputs: Record<string, number>
}

export type FriendSplit = {
  paidBy: 'me' | 'friend'
  split: 'equal' | 'full' | 'exact'
  /** With 'exact': what the person who didn't pay owes, in cents. */
  owedCents: number
}

/** Everyone in, split equally, paid by you. */
export function defaultGroupSplit(memberIds: Array<string>, me: string): GroupSplit {
  return { payer: me, mode: 'equal', included: [...memberIds], inputs: {} }
}

/** Starting inputs when switching to a mode: an even split of `amountCents`. */
export function seedInputs(mode: GroupMode, memberIds: Array<string>, amountCents: number): Record<string, number> {
  if (mode === 'shares') return Object.fromEntries(memberIds.map((id) => [id, 1]))
  if (mode === 'percent') {
    const even = equalSplit(10_000, memberIds, memberIds)
    return Object.fromEntries(memberIds.map((id) => [id, even.get(id) ?? 0]))
  }
  if (mode === 'exact') {
    const even = equalSplit(amountCents, memberIds, memberIds)
    return Object.fromEntries(memberIds.map((id) => [id, even.get(id) ?? 0]))
  }
  return {}
}

/** Who owes what for the split as it stands (member order kept). */
export function groupOwed(split: GroupSplit, amountCents: number, order: Array<string>) {
  if (split.mode === 'equal') return equalSplit(amountCents, split.included, order)
  return computeSplit(split.mode, amountCents, split.inputs, order)
}

/** What's wrong with the split, or null. */
export function groupSplitProblem(split: GroupSplit, amountCents: number, order: Array<string>) {
  if (amountCents <= 0) return null
  const owed = groupOwed(split, amountCents, order)
  return splitProblem(split.mode, amountCents, split.mode === 'equal' ? {} : split.inputs, owed)
}

/** What an expense does to one member's balance: paid minus their share. */
export function effectFor(memberId: string, payer: string, amountCents: number, owed: Map<string, number>) {
  return (memberId === payer ? amountCents : 0) - (owed.get(memberId) ?? 0)
}

/** "Equally · 5", "Amounts", "Shares · 3": the split chip's label. */
export function groupSplitLabel(split: GroupSplit, amountCents: number, order: Array<string>) {
  if (split.mode === 'equal') return `Equally · ${split.included.length}`
  const people = groupOwed(split, amountCents, order).size
  const name = { exact: 'Amounts', percent: 'By %', shares: 'Shares' }[split.mode]
  return people ? `${name} · ${people}` : name
}

/** What the other person owes for a friend expense, from the payer's side. */
export function friendOwed(split: FriendSplit, amountCents: number) {
  if (split.split === 'full') return amountCents
  if (split.split === 'exact') return split.owedCents
  // The payer keeps the odd cent, as the backend does.
  return Math.floor(amountCents / 2)
}

/** The friend expense's effect on your balance with them (positive: they owe you). */
export function friendEffect(split: FriendSplit, amountCents: number) {
  const owed = friendOwed(split, amountCents)
  return split.paidBy === 'me' ? owed : -owed
}

export function friendSplitProblem(split: FriendSplit, amountCents: number) {
  if (split.split === 'exact' && (split.owedCents <= 0 || split.owedCents > amountCents)) {
    return amountCents > 0 ? 'Enter an amount up to the total.' : null
  }
  return null
}

type Common = {
  description: string
  amountCents: number
  category: Category
  date: string
}

/** Arguments for `groups.addExpense` (and, with an id, `updateExpense`). */
export function groupArgs(common: Common, split: GroupSplit, order: Array<string>) {
  const base = {
    ...common,
    paidBy: split.payer,
  }
  if (split.mode === 'equal') {
    return { ...base, splitAmong: order.filter((id) => split.included.includes(id)) }
  }
  const owed = groupOwed(split, common.amountCents, order)
  const inputs = Object.fromEntries(Object.entries(split.inputs).filter(([, v]) => v > 0))
  return {
    ...base,
    splitAmong: [...owed.keys()],
    split: { mode: split.mode, inputs },
  }
}

/** Arguments for `friends.addExpense` (and `updateExpense`). */
export function friendArgs(common: Common & { currency: Currency }, split: FriendSplit) {
  return {
    ...common,
    paidBy: split.paidBy,
    split: split.split,
    ...(split.split === 'exact' ? { owedCents: split.owedCents } : {}),
  }
}

/** Reads a group expense's saved split back into the form's state. */
export function splitFromSaved(
  saved: {
    paidBy: string
    splitAmong: Array<string>
    split: {
      mode: 'exact' | 'percent' | 'shares' | 'items'
      inputs?: Record<string, number>
      owed: Record<string, number>
    } | null
  },
  memberIds: Array<string>,
): GroupSplit {
  if (!saved.split) {
    return { payer: saved.paidBy, mode: 'equal', included: saved.splitAmong, inputs: {} }
  }
  // Itemised bills are edited line by line on the web; here they come back
  // as the amounts each person owes.
  if (saved.split.mode === 'items') {
    return { payer: saved.paidBy, mode: 'exact', included: memberIds, inputs: { ...saved.split.owed } }
  }
  return {
    payer: saved.paidBy,
    mode: saved.split.mode,
    included: memberIds,
    inputs: { ...(saved.split.inputs ?? saved.split.owed) },
  }
}
