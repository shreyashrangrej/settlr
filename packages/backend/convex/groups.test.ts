import { describe, expect, test } from 'vitest'

import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { as, setup, today, type Backend } from './test.setup'

// A group of three (Alice owns it; Bob and Cara are just names) in INR.
async function tripGroup(t: Backend) {
  const alice = as(t, 'Alice')
  const groupId = await alice.mutation(api.groups.create, {
    name: 'Goa trip',
    currency: 'INR',
    members: ['Bob', 'Cara'],
  })
  return { alice, groupId }
}

const expense = (overrides: Partial<{
  description: string
  amountCents: number
  paidBy: string
  splitAmong: Array<string>
}> = {}) => ({
  description: 'Dinner',
  amountCents: 90_000,
  paidBy: 'm1',
  splitAmong: ['m1', 'm2', 'm3'],
  category: 'food' as const,
  date: today(),
  ...overrides,
})

const net = (group: { members: Array<{ id: string; netCents: number }> } | null) =>
  Object.fromEntries(group!.members.map((m) => [m.id, m.netCents]))

describe('group balances', () => {
  test('an equal split moves the balances and the settle-up plan', async () => {
    const t = setup()
    const { alice, groupId } = await tripGroup(t)
    await alice.mutation(api.groups.addExpense, { groupId, ...expense() })

    const group = await alice.query(api.groups.get, { groupId })
    // Alice paid 900 and owes 300 of it: the others owe her 300 each.
    expect(net(group)).toEqual({ m1: 60_000, m2: -30_000, m3: -30_000 })
    expect(group!.settlements).toEqual([
      { from: 'm2', to: 'm1', amountCents: 30_000 },
      { from: 'm3', to: 'm1', amountCents: 30_000 },
    ])
    expect(group!.totalCents).toBe(90_000)
    expect(group!.expenseCount).toBe(1)
  })

  test('leftover cents go to the first members, so shares add up', async () => {
    const t = setup()
    const { alice, groupId } = await tripGroup(t)
    await alice.mutation(api.groups.addExpense, { groupId, ...expense({ amountCents: 100 }) })

    const group = await alice.query(api.groups.get, { groupId })
    // 100 cents three ways: 34 + 33 + 33.
    expect(net(group)).toEqual({ m1: 66, m2: -33, m3: -33 })
    expect(Object.values(net(group)).reduce((a, b) => a + b, 0)).toBe(0)
  })

  test('a percent split is stored as what each member owes', async () => {
    const t = setup()
    const { alice, groupId } = await tripGroup(t)
    await alice.mutation(api.groups.addExpense, {
      groupId,
      ...expense({ amountCents: 10_000 }),
      split: { mode: 'percent', inputs: { m1: 5000, m2: 3000, m3: 2000 } },
    })
    const group = await alice.query(api.groups.get, { groupId })
    expect(net(group)).toEqual({ m1: 5000, m2: -3000, m3: -2000 })
  })

  test('a split that doesn’t add up is refused', async () => {
    const t = setup()
    const { alice, groupId } = await tripGroup(t)
    await expect(
      alice.mutation(api.groups.addExpense, {
        groupId,
        ...expense(),
        split: { mode: 'percent', inputs: { m1: 5000, m2: 3000 } },
      }),
    ).rejects.toThrow('not 100%')
    await expect(
      alice.mutation(api.groups.addExpense, { groupId, ...expense({ amountCents: 0 }) }),
    ).rejects.toThrow('greater than zero')
    await expect(
      alice.mutation(api.groups.addExpense, { groupId, ...expense({ paidBy: 'm9' }) }),
    ).rejects.toThrow('not a member')
  })

  test('editing an expense replaces its effect instead of adding to it', async () => {
    const t = setup()
    const { alice, groupId } = await tripGroup(t)
    const expenseId = await alice.mutation(api.groups.addExpense, { groupId, ...expense() })
    await alice.mutation(api.groups.updateExpense, {
      expenseId,
      ...expense({ amountCents: 30_000, paidBy: 'm2' }),
      receiptId: null,
    })
    const group = await alice.query(api.groups.get, { groupId })
    expect(net(group)).toEqual({ m1: -10_000, m2: 20_000, m3: -10_000 })
    expect(group!.totalCents).toBe(30_000)
  })

  test('a settle-up payment clears what was owed', async () => {
    const t = setup()
    const { alice, groupId } = await tripGroup(t)
    await alice.mutation(api.groups.addExpense, { groupId, ...expense() })
    await alice.mutation(api.groups.addPayment, {
      groupId,
      from: 'm2',
      to: 'm1',
      amountCents: 30_000,
      date: today(),
    })
    const group = await alice.query(api.groups.get, { groupId })
    expect(net(group)).toEqual({ m1: 30_000, m2: 0, m3: -30_000 })
    expect(group!.settlements).toEqual([{ from: 'm3', to: 'm1', amountCents: 30_000 }])
  })
})

describe('trash', () => {
  test('deleting puts the balances back, restoring brings them back', async () => {
    const t = setup()
    const { alice, groupId } = await tripGroup(t)
    const expenseId = await alice.mutation(api.groups.addExpense, { groupId, ...expense() })

    const trashId = await alice.mutation(api.groups.removeExpense, { expenseId })
    let group = await alice.query(api.groups.get, { groupId })
    expect(net(group)).toEqual({ m1: 0, m2: 0, m3: 0 })
    expect(group!.expenseCount).toBe(0)
    expect(await alice.query(api.trash.list, {})).toMatchObject([
      { description: 'Dinner', amountCents: 90_000, kind: 'group', where: 'Goa trip' },
    ])

    await alice.mutation(api.trash.restore, { trashId })
    group = await alice.query(api.groups.get, { groupId })
    expect(net(group)).toEqual({ m1: 60_000, m2: -30_000, m3: -30_000 })
    expect(await alice.query(api.trash.list, {})).toEqual([])
  })
})

describe('access', () => {
  test('signed-out callers are refused', async () => {
    const t = setup()
    await expect(t.query(api.groups.list, {})).rejects.toThrow('Sign in')
  })

  test('someone outside the group can’t see or change it', async () => {
    const t = setup()
    const { alice, groupId } = await tripGroup(t)
    const expenseId = await alice.mutation(api.groups.addExpense, { groupId, ...expense() })
    const mallory = as(t, 'Mallory')

    expect(await mallory.query(api.groups.get, { groupId })).toBeNull()
    expect(await mallory.query(api.groups.list, {})).toEqual([])
    await expect(
      mallory.mutation(api.groups.addExpense, { groupId, ...expense() }),
    ).rejects.toThrow('doesn’t exist')
    await expect(mallory.mutation(api.groups.removeExpense, { expenseId })).rejects.toThrow(
      'doesn’t exist',
    )
    // Nothing changed.
    const group = await alice.query(api.groups.get, { groupId })
    expect(group!.expenseCount).toBe(1)
  })

  test('a malformed id from the URL is a missing group, not an error', async () => {
    const t = setup()
    expect(await as(t, 'Alice').query(api.groups.get, { groupId: 'not-an-id' })).toBeNull()
  })
})

describe('invite links', () => {
  test('joining as an existing member keeps their history and shows the group', async () => {
    const t = setup()
    const { alice, groupId } = await tripGroup(t)
    await alice.mutation(api.groups.addExpense, { groupId, ...expense() })
    const token = await alice.mutation(api.groups.setLink, {
      groupId,
      link: 'invite',
      enabled: true,
    })
    const bob = as(t, 'Bob')

    const invite = await bob.query(api.groups.invite, { token: token! })
    expect(invite!.open.map((m) => m.name)).toEqual(['Bob', 'Cara'])
    await bob.mutation(api.groups.join, { token: token!, memberId: 'm2' })

    const group = await bob.query(api.groups.get, { groupId })
    expect(group!.meMemberId).toBe('m2')
    expect(group!.isOwner).toBe(false)
    expect((await bob.query(api.groups.list, {}))[0].myNetCents).toBe(-30_000)
    // Alice is told.
    const { items } = await alice.query(api.notifications.list, {})
    expect(items[0]).toMatchObject({ kind: 'group_joined', actorName: 'Bob' })
  })

  test('a payment recorded for a linked member waits for them to confirm', async () => {
    const t = setup()
    const { alice, groupId } = await tripGroup(t)
    await alice.mutation(api.groups.addExpense, { groupId, ...expense() })
    const token = (await alice.mutation(api.groups.setLink, {
      groupId,
      link: 'invite',
      enabled: true,
    }))!
    const bob = as(t, 'Bob')
    await bob.mutation(api.groups.join, { token, memberId: 'm2' })

    // Alice says she paid Bob; only Bob can confirm or reject it.
    const paymentId = await alice.mutation(api.groups.addPayment, {
      groupId,
      from: 'm1',
      to: 'm2',
      amountCents: 1000,
      date: today(),
    })
    await expect(
      alice.mutation(api.groups.answerPayment, { paymentId, confirm: true }),
    ).rejects.toThrow('Only the person who got this payment')
    await bob.mutation(api.groups.answerPayment, { paymentId, confirm: false })

    // Rejecting deletes it, so the balances are as before the payment.
    const group = await alice.query(api.groups.get, { groupId })
    expect(net(group)).toEqual({ m1: 60_000, m2: -30_000, m3: -30_000 })
  })

  test('a disabled link stops working', async () => {
    const t = setup()
    const { alice, groupId } = await tripGroup(t)
    const token = (await alice.mutation(api.groups.setLink, {
      groupId,
      link: 'invite',
      enabled: true,
    }))!
    await alice.mutation(api.groups.setLink, { groupId, link: 'invite', enabled: false })
    await expect(
      as(t, 'Bob').mutation(api.groups.join, { token, memberId: null }),
    ).rejects.toThrow('no longer works')
    void (groupId satisfies Id<'groups'>)
  })
})
