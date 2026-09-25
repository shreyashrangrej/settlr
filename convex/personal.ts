import { ConvexError, v } from 'convex/values'

import type { Doc } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import { requireUser } from './lib/auth'
import * as input from './lib/input'
import { category, currency } from './lib/validators'

// Enough for any realistic month; the page says so if a month has more.
const MAX_PER_MONTH = 1000

function nextMonth(month: string) {
  const [year, m] = month.split('-').map(Number)
  return m === 12
    ? `${year + 1}-01`
    : `${year}-${String(m + 1).padStart(2, '0')}`
}

/** One month of the caller's own spending, newest first, with totals. */
export const month = query({
  args: { month: v.string() },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const month = input.isoMonth(args.month)
    const rows = await ctx.db
      .query('personalExpenses')
      .withIndex('by_userId_and_date', (q) =>
        q
          .eq('userId', userId)
          .gte('date', `${month}-01`)
          .lt('date', `${nextMonth(month)}-01`),
      )
      .order('desc')
      .take(MAX_PER_MONTH + 1)
    const items = rows.slice(0, MAX_PER_MONTH)

    type Row = Pick<Doc<'personalExpenses'>, 'category' | 'currency'> & {
      cents: number
    }
    const totals = new Map<Doc<'personalExpenses'>['currency'], number>()
    const byCategory = new Map<string, Row>()
    for (const e of items) {
      totals.set(e.currency, (totals.get(e.currency) ?? 0) + e.amountCents)
      const key = `${e.currency}:${e.category}`
      const row: Row = byCategory.get(key) ?? {
        category: e.category,
        currency: e.currency,
        cents: 0,
      }
      row.cents += e.amountCents
      byCategory.set(key, row)
    }

    return {
      month,
      items: items.map((e) => ({
        id: e._id,
        description: e.description,
        amountCents: e.amountCents,
        currency: e.currency,
        category: e.category,
        date: e.date,
      })),
      truncated: rows.length > MAX_PER_MONTH,
      totals: [...totals]
        .map(([currency, cents]) => ({ currency, cents }))
        .sort((a, b) => b.cents - a.cents),
      byCategory: [...byCategory.values()].sort((a, b) => b.cents - a.cents),
    }
  },
})

export const add = mutation({
  args: {
    description: v.string(),
    amountCents: v.number(),
    currency,
    category,
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    await ctx.db.insert('personalExpenses', {
      userId,
      description: input.text(args.description, 'Description', 80),
      amountCents: input.amount(args.amountCents),
      currency: args.currency,
      category: args.category,
      date: input.isoDate(args.date),
    })
    return null
  },
})

export const remove = mutation({
  args: { expenseId: v.id('personalExpenses') },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const expense = await ctx.db.get('personalExpenses', args.expenseId)
    if (!expense || expense.userId !== userId) {
      throw new ConvexError('That expense doesn’t exist.')
    }
    await ctx.db.delete('personalExpenses', expense._id)
    return null
  },
})
