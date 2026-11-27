import { ConvexError, v } from 'convex/values'

import type { Doc } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import { monthItems } from './expenses'
import { requireUser } from './lib/auth'
import * as input from './lib/input'
import { category, currency } from './lib/validators'

// Monthly budgets for what you spend: your personal expenses plus your share
// of expenses with friends and in groups. There are only a handful of
// currencies, so a user has at most one budget each.

type Currency = Doc<'budgets'>['currency']

/**
 * What you spent in a month, per currency: personal expenses, your share of
 * one-on-one expenses with friends, and your share of group expenses (the
 * same items as the Expenses page). Settle-up payments aren't spending.
 */
export const monthSpending = query({
  args: { month: v.string() },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const { items } = await monthItems(ctx, userId, input.isoMonth(args.month))
    const field = { personal: 'personal', friend: 'friends', group: 'groups' } as const
    const totals = new Map<
      Currency,
      { personal: number; friends: number; groups: number; byCategory: Record<string, number> }
    >()
    for (const item of items) {
      if (!item.shareCents) continue
      const row = totals.get(item.currency) ?? { personal: 0, friends: 0, groups: 0, byCategory: {} }
      row[field[item.source]] += item.shareCents
      row.byCategory[item.category] = (row.byCategory[item.category] ?? 0) + item.shareCents
      totals.set(item.currency, row)
    }

    return [...totals]
      .map(([currency, row]) => ({
        currency,
        ...row,
        total: row.personal + row.friends + row.groups,
      }))
      .sort((a, b) => b.total - a.total)
  },
})

/** The caller's monthly budgets, one per currency. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireUser(ctx)
    const rows = await ctx.db
      .query('budgets')
      .withIndex('by_userId_and_currency', (q) => q.eq('userId', userId))
      .take(20)
    return rows.map((row) => ({
      currency: row.currency,
      amountCents: row.amountCents,
      byCategory: row.byCategory ?? {},
    }))
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

/**
 * Sets (or with null, clears) a limit for one category inside a currency's
 * budget. The monthly budget must exist first.
 */
export const setCategory = mutation({
  args: { currency, category, amountCents: v.union(v.number(), v.null()) },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const existing = await ctx.db
      .query('budgets')
      .withIndex('by_userId_and_currency', (q) =>
        q.eq('userId', userId).eq('currency', args.currency),
      )
      .unique()
    if (!existing) throw new ConvexError(`Set a monthly ${args.currency} budget first.`)
    const byCategory = { ...(existing.byCategory ?? {}) }
    if (args.amountCents === null) delete byCategory[args.category]
    else byCategory[args.category] = input.amount(args.amountCents)
    await ctx.db.patch('budgets', existing._id, { byCategory })
    return null
  },
})
