import { expect, test } from 'vitest'

import { api } from './_generated/api'
import { as, setup, today } from './test.setup'

test('a month’s spending is your share from every source, like the Expenses page', async () => {
  const t = setup()
  const alice = as(t, 'Alice')
  const common = { category: 'food' as const, date: today() }
  await alice.mutation(api.personal.add, { ...common, description: 'Tea', amountCents: 5000, currency: 'INR' })
  const friendId = await alice.mutation(api.friends.create, { name: 'Sam' })
  // Equal split of 10.01: Sam owes 5.00, so it cost Alice 5.01.
  await alice.mutation(api.friends.addExpense, {
    ...common,
    friendId,
    description: 'Lunch',
    amountCents: 1001,
    currency: 'USD',
    paidBy: 'me',
    split: 'equal',
  })
  // Alice paid for Sam in full: it cost her nothing, so it isn't spending.
  await alice.mutation(api.friends.addExpense, {
    ...common,
    friendId,
    description: 'Taxi',
    amountCents: 900,
    currency: 'GBP',
    paidBy: 'me',
    split: 'full',
  })
  const groupId = await alice.mutation(api.groups.create, {
    name: 'Trip',
    currency: 'INR',
    members: ['Bob', 'Cara'],
  })
  await alice.mutation(api.groups.addExpense, {
    ...common,
    groupId,
    description: 'Dinner',
    amountCents: 90_000,
    paidBy: 'm2',
    splitAmong: ['m1', 'm2', 'm3'],
  })

  const month = today().slice(0, 7)
  expect(await alice.query(api.budgets.monthSpending, { month })).toEqual([
    { currency: 'INR', personal: 5000, friends: 0, groups: 30_000, byCategory: { food: 35_000 }, total: 35_000 },
    { currency: 'USD', personal: 0, friends: 501, groups: 0, byCategory: { food: 501 }, total: 501 },
  ])
  const list = await alice.query(api.expenses.month, {
    month,
    q: '',
    category: 'all',
    source: 'all',
    sort: 'date',
    order: 'desc',
    limit: 50,
  })
  expect(list.totals.map((row) => [row.currency, row.share])).toEqual([
    ['INR', 35_000],
    ['USD', 501],
    ['GBP', 0],
  ])
})
