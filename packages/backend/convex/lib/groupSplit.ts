import { ConvexError } from 'convex/values'

import { MAX_ITEMS, computeSplit, itemisedSplit, splitProblem } from '@settlr/shared/split'
import * as input from './input'
import type { GroupSplit, GroupSplitInput } from './validators'

/**
 * Checks an unequal split against the group's members and works out what
 * each one owes (the server never trusts a client's sums). Returns the split
 * to store and who's part of it.
 */
export function resolveSplit(
  order: Array<string>,
  amountCents: number,
  split: GroupSplitInput,
): { split: GroupSplit; splitAmong: Array<string> } {
  const members = new Set(order)
  if (split.mode === 'items') {
    const raw = split.items ?? []
    if (raw.length === 0) throw new ConvexError('Add at least one item.')
    if (raw.length > MAX_ITEMS) throw new ConvexError(`A bill can have up to ${MAX_ITEMS} items.`)
    const items = raw.map((item) => {
      const memberIds = order.filter((id) => item.memberIds.includes(id))
      if (memberIds.length === 0 || memberIds.length !== new Set(item.memberIds).size) {
        throw new ConvexError('Every item needs at least one person from the group.')
      }
      return {
        name: input.text(item.name, 'Item name', 60),
        amountCents: input.amount(item.amountCents),
        memberIds,
      }
    })
    const extraCents = split.extraCents ?? 0
    if (!Number.isInteger(extraCents) || Math.abs(extraCents) > amountCents) {
      throw new ConvexError('Enter tax and tip in the group’s currency.')
    }
    const itemsTotal = items.reduce((acc, item) => acc + item.amountCents, 0)
    if (itemsTotal + extraCents !== amountCents) {
      throw new ConvexError('The items plus tax and tip must add up to the amount.')
    }
    const owed = itemisedSplit(items, extraCents, order)
    return {
      split: {
        mode: 'items',
        owed: Object.fromEntries(owed),
        items,
        ...(extraCents ? { extraCents } : {}),
      },
      splitAmong: order.filter((id) => owed.has(id)),
    }
  }

  const inputs: Record<string, number> = {}
  for (const [id, value] of Object.entries(split.inputs ?? {})) {
    if (!members.has(id)) throw new ConvexError('Expenses can only be split between group members.')
    const limit = split.mode === 'shares' ? 1000 : split.mode === 'percent' ? 10_000 : amountCents
    if (!Number.isInteger(value) || value < 0 || value > limit) {
      throw new ConvexError('Check the split: every share must be a positive number.')
    }
    if (value > 0) inputs[id] = value
  }
  const owed = computeSplit(split.mode, amountCents, inputs, order)
  const problem = splitProblem(split.mode, amountCents, inputs, owed)
  if (problem) throw new ConvexError(problem)
  return {
    split: { mode: split.mode, owed: Object.fromEntries(owed), inputs },
    splitAmong: order.filter((id) => owed.has(id)),
  }
}
