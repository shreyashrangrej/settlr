import { v } from 'convex/values'

import { mutation, query } from './_generated/server'
import { requireUser } from './lib/auth'
import * as input from './lib/input'
import { currency } from './lib/validators'

// Monthly budgets for personal spending. There are only a handful of
// currencies, so a user has at most one budget each.

/** The caller's monthly budgets, one per currency. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireUser(ctx)
    const rows = await ctx.db
      .query('budgets')
      .withIndex('by_userId_and_currency', (q) => q.eq('userId', userId))
      .take(20)
    return rows.map((row) => ({ currency: row.currency, amountCents: row.amountCents }))
  },
})

/** Sets (or replaces) the monthly budget for a currency. */
export const set = mutation({
  args: { currency, amountCents: v.number() },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const amountCents = input.amount(args.amountCents)
    const existing = await ctx.db
      .query('budgets')
      .withIndex('by_userId_and_currency', (q) =>
        q.eq('userId', userId).eq('currency', args.currency),
      )
      .unique()
    if (existing) {
      await ctx.db.patch('budgets', existing._id, { amountCents })
    } else {
      await ctx.db.insert('budgets', { userId, currency: args.currency, amountCents })
    }
    return null
  },
})

export const remove = mutation({
  args: { currency },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const existing = await ctx.db
      .query('budgets')
      .withIndex('by_userId_and_currency', (q) =>
        q.eq('userId', userId).eq('currency', args.currency),
      )
      .unique()
    if (existing) await ctx.db.delete('budgets', existing._id)
    return null
  },
})
