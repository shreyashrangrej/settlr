import { ConvexError, v } from 'convex/values'

import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import {
  internalMutation,
  mutation,
  query,
  type QueryCtx,
} from './_generated/server'
import { requireUser } from './lib/auth'
import * as input from './lib/input'
import { addToBalance, friendDelta } from './lib/ledger'
import { category, currency } from './lib/validators'

const MAX_FRIENDS = 500
const paidBy = v.union(v.literal('me'), v.literal('friend'))

// The caller's friend, or null if the id is malformed, missing or someone
// else's. Taking a string (not v.id) lets pages turn bad URLs into a 404.
async function findFriend(ctx: QueryCtx, userId: string, friendId: string) {
  const id = ctx.db.normalizeId('friends', friendId)
  const friend = id ? await ctx.db.get('friends', id) : null
  return friend && friend.userId === userId ? friend : null
}

async function requireFriend(ctx: QueryCtx, userId: string, friendId: string) {
  const friend = await findFriend(ctx, userId, friendId)
  if (!friend) throw new ConvexError('That friend doesn’t exist.')
  return friend
}

function toFriend(friend: Doc<'friends'>) {
  return {
    id: friend._id,
    name: friend.name,
    email: friend.email ?? null,
    balances: friend.balances,
    lastActivityAt: friend.lastActivityAt,
  }
}

/** Friends, most recent activity first, with what each owes (or is owed). */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireUser(ctx)
    const friends = await ctx.db
      .query('friends')
      .withIndex('by_userId_and_lastActivityAt', (q) => q.eq('userId', userId))
      .order('desc')
      .take(MAX_FRIENDS)
    return friends.map(toFriend)
  },
})

export const get = query({
  args: { friendId: v.string() },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const friend = await findFriend(ctx, userId, args.friendId)
    return friend ? toFriend(friend) : null
  },
})

/** The one-on-one ledger with a friend, newest first. */
export const entries = query({
  args: { friendId: v.string(), limit: v.number() },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const friend = await findFriend(ctx, userId, args.friendId)
    if (!friend) return { items: [], hasMore: false }
    const limit = input.listLimit(args.limit)
    const rows = await ctx.db
      .query('friendEntries')
      .withIndex('by_friendId_and_date', (q) => q.eq('friendId', friend._id))
      .order('desc')
      .take(limit + 1)
    return {
      items: rows.slice(0, limit).map(({ userId: _, friendId: __, ...entry }) => ({
        ...entry,
        id: entry._id,
        effectCents: friendDelta(entry),
      })),
      hasMore: rows.length > limit,
    }
  },
})

export const create = mutation({
  args: { name: v.string(), email: v.optional(v.string()) },
  handler: async (ctx, args): Promise<Id<'friends'>> => {
    const { userId } = await requireUser(ctx)
    const name = input.text(args.name, 'Name', 60)
    const email = input.email(args.email)

    const existing = await ctx.db
      .query('friends')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .take(MAX_FRIENDS)
    if (existing.length >= MAX_FRIENDS) {
      throw new ConvexError(`You can have up to ${MAX_FRIENDS} friends.`)
    }
    if (existing.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
      throw new ConvexError(`You already have a friend called ${name}.`)
    }

    return await ctx.db.insert('friends', {
      userId,
      name,
      email,
      balances: {},
      lastActivityAt: Date.now(),
    })
  },
})

/** Deletes a friend and their whole ledger with you. */
export const remove = mutation({
  args: { friendId: v.id('friends') },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const friend = await requireFriend(ctx, userId, args.friendId)
    await ctx.db.delete('friends', friend._id)
    await ctx.scheduler.runAfter(0, internal.friends.deleteEntries, {
      friendId: friend._id,
    })
    return null
  },
})

export const deleteEntries = internalMutation({
  args: { friendId: v.id('friends') },
  handler: async (ctx, args) => {
    const batch = await ctx.db
      .query('friendEntries')
      .withIndex('by_friendId_and_date', (q) => q.eq('friendId', args.friendId))
      .take(200)
    for (const row of batch) await ctx.db.delete('friendEntries', row._id)
    if (batch.length === 200) {
      await ctx.scheduler.runAfter(0, internal.friends.deleteEntries, args)
    }
    return null
  },
})

export const addExpense = mutation({
  args: {
    friendId: v.id('friends'),
    description: v.string(),
    amountCents: v.number(),
    currency,
    category,
    paidBy,
    split: v.union(v.literal('equal'), v.literal('full')),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const friend = await requireFriend(ctx, userId, args.friendId)
    const entry = {
      kind: 'expense' as const,
      userId,
      friendId: friend._id,
      description: input.text(args.description, 'Description', 80),
      amountCents: input.amount(args.amountCents),
      currency: args.currency,
      category: args.category,
      paidBy: args.paidBy,
      split: args.split,
      date: input.isoDate(args.date),
    }
    await ctx.db.insert('friendEntries', entry)
    await ctx.db.patch('friends', friend._id, {
      balances: addToBalance(friend.balances, entry.currency, friendDelta(entry)),
      lastActivityAt: Date.now(),
    })
    return null
  },
})

/** Records a settle-up payment between you and a friend. */
export const addPayment = mutation({
  args: {
    friendId: v.id('friends'),
    amountCents: v.number(),
    currency,
    paidBy,
    note: v.optional(v.string()),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const friend = await requireFriend(ctx, userId, args.friendId)
    const entry = {
      kind: 'payment' as const,
      userId,
      friendId: friend._id,
      amountCents: input.amount(args.amountCents),
      currency: args.currency,
      paidBy: args.paidBy,
      note: input.optionalText(args.note, 'Note', 80),
      date: input.isoDate(args.date),
    }
    await ctx.db.insert('friendEntries', entry)
    await ctx.db.patch('friends', friend._id, {
      balances: addToBalance(friend.balances, entry.currency, friendDelta(entry)),
      lastActivityAt: Date.now(),
    })
    return null
  },
})

export const removeEntry = mutation({
  args: { entryId: v.id('friendEntries') },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const entry = await ctx.db.get('friendEntries', args.entryId)
    if (!entry || entry.userId !== userId) {
      throw new ConvexError('That entry doesn’t exist.')
    }
    const friend = await requireFriend(ctx, userId, entry.friendId)
    await ctx.db.delete('friendEntries', entry._id)
    await ctx.db.patch('friends', friend._id, {
      balances: addToBalance(friend.balances, entry.currency, -friendDelta(entry)),
    })
    return null
  },
})
