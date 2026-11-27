import { describe, expect, test } from 'vitest'

import { api, internal } from './_generated/api'
import { advance } from './recurring'
import { as, setup, today } from './test.setup'

describe('recurring expenses', () => {
  test('the next date keeps the day it was set up on where the month has it', () => {
    expect(advance('2026-01-31', 'monthly', 31)).toBe('2026-02-28')
    expect(advance('2026-02-28', 'monthly', 31)).toBe('2026-03-31')
    expect(advance('2028-01-31', 'monthly', 31)).toBe('2028-02-29')
    expect(advance('2026-12-15', 'monthly', 15)).toBe('2027-01-15')
    expect(advance('2028-02-29', 'yearly', 29)).toBe('2029-02-28')
    expect(advance('2026-12-29', 'weekly', 29)).toBe('2027-01-05')
  })

  test('the daily job catches up, moves the date on, and pauses a template whose group is gone', async () => {
    const t = setup()
    const alice = as(t, 'Alice')
    const groupId = await alice.mutation(api.groups.create, {
      name: 'Flat',
      currency: 'USD',
      members: ['Bob'],
    })
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const template = {
      userId: 'test|alice',
      userName: 'Alice',
      description: 'Cleaner',
      amountCents: 4000,
      currency: 'USD' as const,
      category: 'utilities' as const,
      frequency: 'weekly' as const,
      anchorDay: 1,
      nextDate: twoWeeksAgo,
      paused: false,
    }
    const [personalId, groupRowId] = await t.run(async (ctx) => [
      await ctx.db.insert('recurring', { ...template, kind: 'personal' }),
      await ctx.db.insert('recurring', {
        ...template,
        kind: 'group',
        groupId,
        paidBy: 'm1',
        splitAmong: ['m1', 'm2'],
      }),
    ])

    await t.mutation(internal.recurring.processDue, {})
    // Two weeks ago, a week ago and today: three of each.
    const added = await t.run(async (ctx) => ({
      personal: (await ctx.db.query('personalExpenses').collect()).length,
      group: (await ctx.db.query('groupExpenses').collect()).length,
      next: (await ctx.db.get('recurring', personalId))!.nextDate,
    }))
    expect(added).toEqual({ personal: 3, group: 3, next: advance(today(), 'weekly', 1) })
    expect((await alice.query(api.groups.get, { groupId }))!.members[1].netCents).toBe(-6000)

    // Running it again adds nothing more.
    await t.mutation(internal.recurring.processDue, {})
    expect(await t.run(async (ctx) => (await ctx.db.query('personalExpenses').collect()).length)).toBe(3)

    await alice.mutation(api.groups.remove, { groupId })
    await t.run(async (ctx) => ctx.db.patch('recurring', groupRowId, { nextDate: today() }))
    await t.mutation(internal.recurring.processDue, {})
    expect(await t.run(async (ctx) => (await ctx.db.get('recurring', groupRowId))!.paused)).toBe(true)
  })
})
