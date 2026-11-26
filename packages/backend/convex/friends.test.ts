import { describe, expect, test } from 'vitest'

import { api } from './_generated/api'
import { as, setup, today } from './test.setup'

const dinner = {
  description: 'Dinner',
  amountCents: 1001,
  currency: 'USD' as const,
  category: 'food' as const,
  date: today(),
}

describe('one-on-one balances', () => {
  test('an equal split: the payer absorbs the odd cent', async () => {
    const t = setup()
    const alice = as(t, 'Alice')
    const friendId = await alice.mutation(api.friends.create, { name: 'Sam' })
    await alice.mutation(api.friends.addExpense, {
      friendId,
      ...dinner,
      paidBy: 'me',
      split: 'equal',
    })
    expect((await alice.query(api.friends.get, { friendId }))!.balances).toEqual({ USD: 500 })
  })

  test('full and exact splits, and a payment that settles it', async () => {
    const t = setup()
    const alice = as(t, 'Alice')
    const friendId = await alice.mutation(api.friends.create, { name: 'Sam' })
    // Sam paid Alice's lunch in full: Alice owes 12.
    await alice.mutation(api.friends.addExpense, {
      friendId,
      ...dinner,
      amountCents: 1200,
      paidBy: 'friend',
      split: 'full',
    })
    // Alice paid 30 and Sam owes 10 of it.
    await alice.mutation(api.friends.addExpense, {
      friendId,
      ...dinner,
      amountCents: 3000,
      paidBy: 'me',
      split: 'exact',
      owedCents: 1000,
    })
    expect((await alice.query(api.friends.get, { friendId }))!.balances).toEqual({ USD: -200 })

    await alice.mutation(api.friends.addPayment, {
      friendId,
      amountCents: 200,
      currency: 'USD',
      paidBy: 'me',
      date: today(),
    })
    // Settled balances are dropped, not kept as zero.
    expect((await alice.query(api.friends.get, { friendId }))!.balances).toEqual({})
  })

  test('an exact share larger than the amount is refused', async () => {
    const t = setup()
    const alice = as(t, 'Alice')
    const friendId = await alice.mutation(api.friends.create, { name: 'Sam' })
    await expect(
      alice.mutation(api.friends.addExpense, {
        friendId,
        ...dinner,
        paidBy: 'me',
        split: 'exact',
        owedCents: 5000,
      }),
    ).rejects.toThrow('between zero and the amount')
  })

  test('friend names are unique per person', async () => {
    const t = setup()
    const alice = as(t, 'Alice')
    await alice.mutation(api.friends.create, { name: 'Sam' })
    await expect(alice.mutation(api.friends.create, { name: 'sam' })).rejects.toThrow(
      'already have a friend called',
    )
    // Someone else can have their own Sam.
    await as(t, 'Bob').mutation(api.friends.create, { name: 'Sam' })
  })
})

describe('linked friends', () => {
  test('after a request is accepted, both sides see the same ledger', async () => {
    const t = setup()
    const alice = as(t, 'Alice')
    const bob = as(t, 'Bob')
    const aliceSideId = await alice.mutation(api.friends.create, {
      name: 'Bob',
      email: 'bob@example.com',
    })
    // History from before the link is shared too.
    await alice.mutation(api.friends.addExpense, {
      friendId: aliceSideId,
      ...dinner,
      amountCents: 4000,
      paidBy: 'me',
      split: 'equal',
    })

    const { requests } = await bob.query(api.notifications.list, {})
    expect(requests).toMatchObject([{ fromName: 'Alice', fromEmail: 'alice@example.com' }])
    const bobSideId = await bob.mutation(api.notifications.acceptRequest, {
      requestId: requests[0].id,
    })

    expect((await alice.query(api.friends.get, { friendId: aliceSideId }))!.status).toBe('linked')
    expect((await bob.query(api.friends.get, { friendId: bobSideId }))!.balances).toEqual({
      USD: -2000,
    })

    // A new expense from Bob's side shows up, flipped, on Alice's.
    await bob.mutation(api.friends.addExpense, {
      friendId: bobSideId,
      ...dinner,
      amountCents: 1000,
      paidBy: 'me',
      split: 'full',
    })
    expect((await alice.query(api.friends.get, { friendId: aliceSideId }))!.balances).toEqual({
      USD: 1000,
    })
    expect((await bob.query(api.friends.get, { friendId: bobSideId }))!.balances).toEqual({
      USD: -1000,
    })
    const { items } = await alice.query(api.notifications.list, {})
    expect(items[0]).toMatchObject({ kind: 'friend_expense', actorName: 'Bob' })
  })

  test('only the addressee can accept a request', async () => {
    const t = setup()
    const alice = as(t, 'Alice')
    await alice.mutation(api.friends.create, { name: 'Bob', email: 'bob@example.com' })
    const { requests } = await as(t, 'Bob').query(api.notifications.list, {})
    await expect(
      as(t, 'Mallory').mutation(api.notifications.acceptRequest, { requestId: requests[0].id }),
    ).rejects.toThrow('no longer available')
  })

  test('you can’t read or change someone else’s friend', async () => {
    const t = setup()
    const friendId = await as(t, 'Alice').mutation(api.friends.create, { name: 'Sam' })
    const mallory = as(t, 'Mallory')
    expect(await mallory.query(api.friends.get, { friendId })).toBeNull()
    await expect(
      mallory.mutation(api.friends.addExpense, {
        friendId,
        ...dinner,
        paidBy: 'me',
        split: 'equal',
      }),
    ).rejects.toThrow('doesn’t exist')
  })
})
