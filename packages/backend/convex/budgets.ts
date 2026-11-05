import { v } from 'convex/values'

import type { Doc } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import { requireUser } from './lib/auth'
import * as input from './lib/input'
import { myFriendShare, shares } from './lib/ledger'
import { currency } from './lib/validators'

// Monthly budgets for what you spend: your personal expenses plus your share
// of expenses with friends and in groups. There are only a handful of
// currencies, so a user has at most one budget each.

type Currency = Doc<'budgets'>['currency']

function nextMonth(month: string) {
  const [year, m] = month.split('-').map(Number)
  return m === 12 ? `${year + 1}-01` : `${year}-${String(m + 1).padStart(2, '0')}`
}

/**
 * What you spent in a month, per currency: personal expenses, your share of
 * one-on-one expenses with friends, and your share of group expenses.
 * Settle-up payments aren't spending, so they don't count.
 */
export const monthSpending = query({
  args: { month: v.string() },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const month = input.isoMonth(args.month)
    const from = `${month}-01`
    const to = `${nextMonth(month)}-01`
    const totals = new Map<Currency, { personal: number; friends: number; groups: number }>()
    const add = (c: Currency, key: 'personal' | 'friends' | 'groups', cents: number) => {
      const row = totals.get(c) ?? { personal: 0, friends: 0, groups: 0 }
      row[key] += cents
      totals.set(c, row)
    }

    const personal = await ctx.db
      .query('personalExpenses')
      .withIndex('by_userId_and_date', (q) =>
        q.eq('userId', userId).gte('date', from).lt('date', to),
      )
      .take(2000)
    for (const e of personal) add(e.currency, 'personal', e.amountCents)

    const friendEntries = await ctx.db
      .query('friendEntries')
      .withIndex('by_userId_and_date', (q) =>
        q.eq('userId', userId).gte('date', from).lt('date', to),
      )
      .take(2000)
    for (const e of friendEntries) {
      if (e.kind === 'expense') add(e.currency, 'friends', myFriendShare(e))
    }

    // Every group you're in, as owner or linked member.
    const owned = await ctx.db
      .query('groups')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .take(200)
    const memberships = await ctx.db
      .query('groupMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .take(200)
    const joined = await Promise.all(memberships.map((m) => ctx.db.get('groups', m.groupId)))
    for (const group of [...owned, ...joined]) {
      if (!group) continue
      const me =
        group.userId === userId
          ? group.meMemberId
          : group.members.find((m) => m.userId === userId)?.id
      if (!me) continue
      const order = group.members.map((m) => m.id)
      const expenses = await ctx.db
        .query('groupExpenses')
        .withIndex('by_groupId_and_date', (q) =>
          q.eq('groupId', group._id).gte('date', from).lt('date', to),
        )
        .take(500)
      for (const e of expenses) {
        const mine = shares(e, order).get(me)
        if (mine) add(group.currency, 'groups', mine)
      }
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
