import { describe, expect, test } from 'vitest'

import { api } from './_generated/api'
import { as, setup } from './test.setup'

const coffee = {
  description: 'Coffee',
  amountCents: 450,
  currency: 'EUR' as const,
  category: 'food' as const,
  date: '2026-03-14',
}

describe('personal expenses', () => {
  test('a month lists only that month, and only yours', async () => {
    const t = setup()
    const alice = as(t, 'Alice')
    await alice.mutation(api.personal.add, coffee)
    await alice.mutation(api.personal.add, { ...coffee, date: '2026-04-01' })
    await as(t, 'Bob').mutation(api.personal.add, coffee)

    const march = await alice.query(api.personal.month, { month: '2026-03' })
    expect(march.items).toHaveLength(1)
    expect(march.items[0]).toMatchObject({ description: 'Coffee', amountCents: 450 })
  })

  test('bad values are refused', async () => {
    const t = setup()
    const alice = as(t, 'Alice')
    await expect(alice.mutation(api.personal.add, { ...coffee, amountCents: 4.5 })).rejects.toThrow(
      'greater than zero',
    )
    // Too large says so, instead of "greater than zero".
    await expect(
      alice.mutation(api.personal.add, { ...coffee, amountCents: 100_000_001 }),
    ).rejects.toThrow('at most 1,000,000.00')
    await alice.mutation(api.personal.add, { ...coffee, amountCents: 100_000_000 })
    await expect(alice.mutation(api.personal.add, { ...coffee, date: '2026-02-30' })).rejects.toThrow(
      'valid date',
    )
    await expect(alice.mutation(api.personal.add, { ...coffee, description: '  ' })).rejects.toThrow(
      'can’t be empty',
    )
  })

  test('deleting goes to the trash and can be undone', async () => {
    const t = setup()
    const alice = as(t, 'Alice')
    const expenseId = await alice.mutation(api.personal.add, coffee)
    const trashId = await alice.mutation(api.personal.remove, { expenseId })
    expect((await alice.query(api.personal.month, { month: '2026-03' })).items).toEqual([])

    // Nobody else can restore it.
    await expect(as(t, 'Bob').mutation(api.trash.restore, { trashId })).rejects.toThrow(
      'no longer in your trash',
    )
    await alice.mutation(api.trash.restore, { trashId })
    expect((await alice.query(api.personal.month, { month: '2026-03' })).items).toHaveLength(1)
  })
})
