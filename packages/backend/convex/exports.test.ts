import { expect, test } from 'vitest'

import { api } from './_generated/api'
import { as, setup, today } from './test.setup'

test('an export over the row cap says it was cut short', async () => {
  const t = setup()
  await t.run(async (ctx) => {
    for (let i = 0; i <= 5000; i++) {
      await ctx.db.insert('personalExpenses', {
        userId: 'test|alice',
        description: `Tea ${i}`,
        amountCents: 100,
        currency: 'INR',
        category: 'food',
        date: today(),
      })
    }
  })
  const result = await as(t, 'Alice').query(api.exports.range, { from: today(), to: today() })
  expect(result.rows).toHaveLength(5000)
  expect(result.truncated).toBe(true)
})
