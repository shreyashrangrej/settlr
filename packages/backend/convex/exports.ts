import { v } from 'convex/values'

import { query } from './_generated/server'
import { myGroups, viewerMemberId } from './groups'
import { requireUser } from './lib/auth'
import * as input from './lib/input'
import { myFriendShare, shares } from './lib/ledger'

// Rows for the CSV export: every expense and settle-up payment you're part
// of between two dates (inclusive), oldest first. The browser turns them
// into a file.

const MAX_ROWS = 5000

export const range = query({
  args: { from: v.string(), to: v.string(), groupId: v.optional(v.id('groups')) },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const from = input.isoDate(args.from)
    const to = input.isoDate(args.to)
    type Row = {
      date: string
      type: 'expense' | 'payment'
      description: string
      category: string
      where: string
      paidBy: string
      amountCents: number
      currency: string
      shareCents: number | null
      tags: string
    }
    const rows: Array<Row> = []

    if (!args.groupId) {
      const personal = await ctx.db
        .query('personalExpenses')
        .withIndex('by_userId_and_date', (q) => q.eq('userId', userId).gte('date', from).lte('date', to))
        .take(MAX_ROWS)
      for (const e of personal) {
        rows.push({
          date: e.date,
          type: 'expense',
          description: e.description,
          category: e.category,
          where: 'Personal',
          paidBy: 'You',
          amountCents: e.amountCents,
          currency: e.currency,
          shareCents: e.amountCents,
          tags: (e.tags ?? []).join(' '),
        })
      }
      const entries = await ctx.db
        .query('friendEntries')
        .withIndex('by_userId_and_date', (q) => q.eq('userId', userId).gte('date', from).lte('date', to))
        .take(MAX_ROWS)
      const names = new Map<string, string>()
      for (const e of entries) {
        if (!names.has(e.friendId)) {
          names.set(e.friendId, (await ctx.db.get('friends', e.friendId))?.name ?? 'Friend')
        }
        const friend = names.get(e.friendId)!
        rows.push({
          date: e.date,
          type: e.kind,
          description: e.kind === 'expense' ? e.description : (e.note ?? 'Payment'),
          category: e.kind === 'expense' ? e.category : '',
          where: friend,
          paidBy: e.paidBy === 'me' ? 'You' : friend,
          amountCents: e.amountCents,
          currency: e.currency,
          shareCents: e.kind === 'expense' ? myFriendShare(e) : null,
          tags: e.kind === 'expense' ? (e.tags ?? []).join(' ') : '',
        })
      }
    }

    const groups = (await myGroups(ctx, userId)).filter(
      (g) => !args.groupId || g._id === args.groupId,
    )
    for (const group of groups) {
      const me = viewerMemberId(group, userId)
      if (!me) continue
      const order = group.members.map((m) => m.id)
      const nameOf = (id: string) =>
        id === me ? 'You' : (group.members.find((m) => m.id === id)?.name ?? 'Former member')
      const expenses = await ctx.db
        .query('groupExpenses')
        .withIndex('by_groupId_and_date', (q) => q.eq('groupId', group._id).gte('date', from).lte('date', to))
        .take(MAX_ROWS)
      for (const e of expenses) {
        rows.push({
          date: e.date,
          type: 'expense',
          description: e.description,
          category: e.category,
          where: group.name,
          paidBy: nameOf(e.paidBy),
          amountCents: e.amountCents,
          currency: group.currency,
          shareCents: shares(e, order).get(me) ?? 0,
          tags: (e.tags ?? []).join(' '),
        })
      }
      const payments = await ctx.db
        .query('groupPayments')
        .withIndex('by_groupId_and_date', (q) => q.eq('groupId', group._id).gte('date', from).lte('date', to))
        .take(MAX_ROWS)
      for (const p of payments) {
        rows.push({
          date: p.date,
          type: 'payment',
          description: `${nameOf(p.from)} paid ${nameOf(p.to)}`,
          category: '',
          where: group.name,
          paidBy: nameOf(p.from),
          amountCents: p.amountCents,
          currency: group.currency,
          shareCents: null,
          tags: '',
        })
      }
      if (rows.length > MAX_ROWS) break
    }
    rows.sort((a, b) => a.date.localeCompare(b.date))
    return { rows: rows.slice(0, MAX_ROWS), truncated: rows.length > MAX_ROWS }
  },
})
