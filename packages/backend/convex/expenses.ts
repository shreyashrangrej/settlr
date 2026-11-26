import { v } from 'convex/values'

import type { Doc } from './_generated/dataModel'
import { query } from './_generated/server'
import { requireUser } from './lib/auth'
import * as input from './lib/input'
import { myFriendShare, shares } from './lib/ledger'
import { category } from './lib/validators'

// Every expense you're part of in one list (the /expenses page): your
// personal expenses, expenses with friends and expenses in your groups,
// one month at a time. Settle-up payments aren't expenses, so they're left
// out. Like `budgets.monthSpending`, it reads the month from each source
// (bounded per source) and merges them here.

type Currency = Doc<'personalExpenses'>['currency']
type Category = Doc<'personalExpenses'>['category']
type Source = 'group' | 'friend' | 'personal'

// Per-source read caps for one month.
const MAX_PERSONAL = 2000
const MAX_FRIEND_ENTRIES = 2000
const MAX_GROUPS = 200
const MAX_PER_GROUP = 500

function nextMonth(month: string) {
  const [year, m] = month.split('-').map(Number)
  return m === 12 ? `${year + 1}-01` : `${year}-${String(m + 1).padStart(2, '0')}`
}

type Item = {
  /** Unique across sources, e.g. `group:<id>`. */
  key: string
  source: Source
  id: string
  description: string
  category: Category
  date: string
  currency: Currency
  amountCents: number
  /** What it cost you: your share of the split (all of it for personal). */
  shareCents: number
  /** Who paid: 'You', a friend's or a group member's name. */
  paidBy: string
  /** Where it lives: the group or friend (null for personal). */
  where: { id: string; name: string } | null
  hasReceipt: boolean
  tags: Array<string>
  _creationTime: number
}

/**
 * The month's expenses across groups, friends and personal, filtered by
 * text, category and source, sorted, and cut to `limit`. The totals and the
 * by-category breakdown cover the whole month (your share), not just the
 * matches.
 */
export const month = query({
  args: {
    month: v.string(),
    q: v.string(),
    category: v.union(v.literal('all'), category),
    source: v.union(
      v.literal('all'),
      v.literal('group'),
      v.literal('friend'),
      v.literal('personal'),
    ),
    sort: v.union(v.literal('date'), v.literal('amount')),
    order: v.union(v.literal('desc'), v.literal('asc')),
    limit: v.number(),
    // Only expenses with this tag ('' for any).
    tag: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const month = input.isoMonth(args.month)
    const limit = input.listLimit(args.limit)
    const from = `${month}-01`
    const to = `${nextMonth(month)}-01`
    const all: Array<Item> = []
    let truncated = false

    const personal = await ctx.db
      .query('personalExpenses')
      .withIndex('by_userId_and_date', (q) =>
        q.eq('userId', userId).gte('date', from).lt('date', to),
      )
      .take(MAX_PERSONAL + 1)
    truncated ||= personal.length > MAX_PERSONAL
    for (const e of personal.slice(0, MAX_PERSONAL)) {
      all.push({
        key: `personal:${e._id}`,
        source: 'personal',
        id: e._id,
        description: e.description,
        category: e.category,
        date: e.date,
        currency: e.currency,
        amountCents: e.amountCents,
        shareCents: e.amountCents,
        paidBy: 'You',
        where: null,
        hasReceipt: e.receiptId !== undefined,
        tags: e.tags ?? [],
        _creationTime: e._creationTime,
      })
    }

    const entries = await ctx.db
      .query('friendEntries')
      .withIndex('by_userId_and_date', (q) =>
        q.eq('userId', userId).gte('date', from).lt('date', to),
      )
      .take(MAX_FRIEND_ENTRIES + 1)
    truncated ||= entries.length > MAX_FRIEND_ENTRIES
    const friendIds = [...new Set(entries.map((e) => e.friendId))]
    const friends = new Map(
      (await Promise.all(friendIds.map((id) => ctx.db.get('friends', id))))
        .filter((f) => f !== null)
        .map((f) => [f._id, f]),
    )
    for (const e of entries.slice(0, MAX_FRIEND_ENTRIES)) {
      if (e.kind !== 'expense') continue
      const friend = friends.get(e.friendId)
      if (!friend) continue
      all.push({
        key: `friend:${e._id}`,
        source: 'friend',
        id: e._id,
        description: e.description,
        category: e.category,
        date: e.date,
        currency: e.currency,
        amountCents: e.amountCents,
        shareCents: myFriendShare(e),
        paidBy: e.paidBy === 'me' ? 'You' : friend.name,
        where: { id: friend._id, name: friend.name },
        hasReceipt: e.receiptId !== undefined,
        tags: e.tags ?? [],
        _creationTime: e._creationTime,
      })
    }

    // Every group you're in, as owner or linked member.
    const owned = await ctx.db
      .query('groups')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .take(MAX_GROUPS)
    const memberships = await ctx.db
      .query('groupMembers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .take(MAX_GROUPS)
    const joined = await Promise.all(memberships.map((m) => ctx.db.get('groups', m.groupId)))
    for (const group of [...owned, ...joined]) {
      if (!group) continue
      const me =
        group.userId === userId
          ? group.meMemberId
          : group.members.find((m) => m.userId === userId)?.id
      if (!me) continue
      const order = group.members.map((m) => m.id)
      const names = new Map(group.members.map((m) => [m.id, m.name]))
      const expenses = await ctx.db
        .query('groupExpenses')
        .withIndex('by_groupId_and_date', (q) =>
          q.eq('groupId', group._id).gte('date', from).lt('date', to),
        )
        .take(MAX_PER_GROUP + 1)
      truncated ||= expenses.length > MAX_PER_GROUP
      for (const e of expenses.slice(0, MAX_PER_GROUP)) {
        all.push({
          key: `group:${e._id}`,
          source: 'group',
          id: e._id,
          description: e.description,
          category: e.category,
          date: e.date,
          currency: group.currency,
          amountCents: e.amountCents,
          shareCents: shares(e, order).get(me) ?? 0,
          paidBy: e.paidBy === me ? 'You' : (names.get(e.paidBy) ?? 'Someone'),
          where: { id: group._id, name: group.name },
          hasReceipt: e.receiptId !== undefined,
          tags: e.tags ?? [],
          _creationTime: e._creationTime,
        })
      }
    }

    // Month totals (your share), per currency and source, and by category.
    const totals = new Map<
      Currency,
      { share: number; group: number; friend: number; personal: number; count: number }
    >()
    const byCategory = new Map<string, { currency: Currency; category: Category; cents: number }>()
    for (const item of all) {
      const row = totals.get(item.currency) ?? {
        share: 0,
        group: 0,
        friend: 0,
        personal: 0,
        count: 0,
      }
      row.share += item.shareCents
      row[item.source] += item.shareCents
      row.count += 1
      totals.set(item.currency, row)
      if (item.shareCents > 0) {
        const key = `${item.currency}:${item.category}`
        const cat = byCategory.get(key) ?? {
          currency: item.currency,
          category: item.category,
          cents: 0,
        }
        cat.cents += item.shareCents
        byCategory.set(key, cat)
      }
    }

    const q = args.q.trim().toLowerCase().slice(0, 100)
    const tag = args.tag?.trim().toLowerCase() ?? ''
    const dir = args.order === 'asc' ? 1 : -1
    const matches = all
      .filter(
        (item) =>
          (args.source === 'all' || item.source === args.source) &&
          (args.category === 'all' || item.category === args.category) &&
          (!tag || item.tags.includes(tag)) &&
          (!q ||
            item.description.toLowerCase().includes(q) ||
            item.tags.some((t) => t.includes(q.replace(/^#/, '')))),
      )
      .sort((a, b) =>
        args.sort === 'amount'
          ? (a.amountCents - b.amountCents) * dir ||
            (b._creationTime - a._creationTime)
          : a.date.localeCompare(b.date) * dir || (b._creationTime - a._creationTime) * dir,
      )

    return {
      month,
      items: matches.slice(0, limit).map(({ _creationTime: _, ...item }) => item),
      hasMore: matches.length > limit,
      matchCount: matches.length,
      totals: [...totals]
        .map(([currency, row]) => ({ currency, ...row }))
        .sort((a, b) => b.share - a.share),
      byCategory: [...byCategory.values()].sort((a, b) => b.cents - a.cents),
      tags: [...new Set(all.flatMap((item) => item.tags))].sort(),
      truncated,
    }
  },
})
