import { describe, expect, it } from 'vitest'

import {
  defaultGroupSplit,
  effectFor,
  friendArgs,
  friendEffect,
  friendSplitProblem,
  groupArgs,
  groupOwed,
  groupSplitLabel,
  groupSplitProblem,
  seedInputs,
  splitFromSaved,
  type GroupSplit,
} from './expense-form'

const order = ['me', 'priya', 'rohan']
const common = { description: 'Dinner', amountCents: 100_00, category: 'food' as const, date: '2026-11-26' }

describe('group splits on Add expense', () => {
  it('starts with everyone, equally, paid by you', () => {
    const split = defaultGroupSplit(order, 'me')
    expect(split).toEqual({ payer: 'me', mode: 'equal', included: order, inputs: {} })
    expect(groupSplitLabel(split, 100_00, order)).toBe('Equally · 3')
  })

  it('splits equally to the cent, the leftover cent to the first person', () => {
    const owed = groupOwed(defaultGroupSplit(order, 'me'), 100_00, order)
    expect(Object.fromEntries(owed)).toEqual({ me: 3334, priya: 3333, rohan: 3333 })
  })

  it('works out what you lend or borrow', () => {
    const split = defaultGroupSplit(order, 'me')
    const owed = groupOwed(split, 90_00, order)
    expect(effectFor('me', 'me', 90_00, owed)).toBe(60_00)
    expect(effectFor('priya', 'me', 90_00, owed)).toBe(-30_00)
  })

  it('sends equal splits as splitAmong in member order, with no split object', () => {
    const split: GroupSplit = { payer: 'priya', mode: 'equal', included: ['rohan', 'me'], inputs: {} }
    expect(groupArgs(common, split, order)).toEqual({ ...common, paidBy: 'priya', splitAmong: ['me', 'rohan'] })
  })

  it('sends shares with their inputs and everyone who owes something', () => {
    const split: GroupSplit = { payer: 'me', mode: 'shares', included: order, inputs: { me: 2, priya: 1, rohan: 0 } }
    expect(groupArgs(common, split, order)).toEqual({
      ...common,
      paidBy: 'me',
      splitAmong: ['me', 'priya'],
      split: { mode: 'shares', inputs: { me: 2, priya: 1 } },
    })
    expect(Object.fromEntries(groupOwed(split, 90_00, order))).toEqual({ me: 60_00, priya: 30_00 })
  })

  it('refuses percentages that do not add up to 100', () => {
    const split: GroupSplit = { payer: 'me', mode: 'percent', included: order, inputs: { me: 5000, priya: 2000 } }
    expect(groupSplitProblem(split, 100_00, order)).toBe('Percentages add up to 70%, not 100%.')
    expect(groupSplitProblem({ ...split, inputs: { ...split.inputs, rohan: 3000 } }, 100_00, order)).toBeNull()
  })

  it('refuses amounts that do not add up to the total', () => {
    const split: GroupSplit = { payer: 'me', mode: 'exact', included: order, inputs: { me: 50_00, priya: 40_00 } }
    expect(groupSplitProblem(split, 100_00, order)).toBe('The shares don’t add up to the total.')
  })

  it('refuses an equal split with nobody in it', () => {
    const split: GroupSplit = { payer: 'me', mode: 'equal', included: [], inputs: {} }
    expect(groupSplitProblem(split, 100_00, order)).toBe('Split it with at least one person.')
  })

  it('seeds a new mode with an even split of the amount', () => {
    expect(seedInputs('exact', order, 100_00)).toEqual({ me: 3334, priya: 3333, rohan: 3333 })
    expect(seedInputs('percent', order, 100_00)).toEqual({ me: 3334, priya: 3333, rohan: 3333 })
    expect(seedInputs('shares', order, 100_00)).toEqual({ me: 1, priya: 1, rohan: 1 })
  })

  it('reads a saved split back for editing; itemised bills come back as amounts', () => {
    expect(splitFromSaved({ paidBy: 'me', splitAmong: ['me', 'rohan'], split: null }, order)).toEqual({
      payer: 'me',
      mode: 'equal',
      included: ['me', 'rohan'],
      inputs: {},
    })
    const items = splitFromSaved(
      { paidBy: 'priya', splitAmong: order, split: { mode: 'items', owed: { me: 10_00, priya: 20_00, rohan: 5_00 } } },
      order,
    )
    expect(items).toMatchObject({ payer: 'priya', mode: 'exact', inputs: { me: 10_00, priya: 20_00, rohan: 5_00 } })
  })
})

describe('friend splits on Add expense', () => {
  it('halves an equal split, the payer keeping the odd cent (as the backend does)', () => {
    expect(friendEffect({ paidBy: 'me', split: 'equal', owedCents: 0 }, 101)).toBe(50)
    expect(friendEffect({ paidBy: 'friend', split: 'equal', owedCents: 0 }, 101)).toBe(-50)
  })

  it('makes the other person owe all of it when owed in full', () => {
    expect(friendEffect({ paidBy: 'me', split: 'full', owedCents: 0 }, 60_00)).toBe(60_00)
  })

  it('uses an exact amount, which must be within the total', () => {
    expect(friendEffect({ paidBy: 'friend', split: 'exact', owedCents: 25_00 }, 60_00)).toBe(-25_00)
    expect(friendSplitProblem({ paidBy: 'me', split: 'exact', owedCents: 70_00 }, 60_00)).toBe('Enter an amount up to the total.')
    expect(friendSplitProblem({ paidBy: 'me', split: 'exact', owedCents: 0 }, 60_00)).toBe('Enter an amount up to the total.')
  })

  it('only sends owedCents with an exact split', () => {
    const base = { ...common, currency: 'INR' as const }
    expect(friendArgs(base, { paidBy: 'me', split: 'equal', owedCents: 999 })).toEqual({ ...base, paidBy: 'me', split: 'equal' })
    expect(friendArgs(base, { paidBy: 'friend', split: 'exact', owedCents: 25_00 })).toEqual({
      ...base,
      paidBy: 'friend',
      split: 'exact',
      owedCents: 25_00,
    })
  })
})
