import { ConvexError, v } from 'convex/values'

import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server'
import { requireUser } from './lib/auth'
import { linkedCounterpart, mirrorEntry, type NewEntry } from './lib/friendship'
import * as input from './lib/input'
import { addToBalance, friendDelta } from './lib/ledger'
import { notify } from './lib/notify'
import { category, currency } from './lib/validators'

const MAX_FRIENDS = 500
const paidBy = v.union(v.literal('me'), v.literal('friend'))

type User = Awaited<ReturnType<typeof requireUser>>

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

// 'linked': on Settlr and connected, sharing this ledger. 'pending' or
// 'declined': a friend request was sent. null: just a name you track.
function statusOf(friend: Doc<'friends'>) {
  if (friend.linkedUserId) return 'linked' as const
  return friend.request ?? null
}

function toFriend(friend: Doc<'friends'>) {
  return {
    id: friend._id,
    name: friend.name,
    email: friend.email ?? null,
    balances: friend.balances,
    lastActivityAt: friend.lastActivityAt,
    status: statusOf(friend),
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
      items: rows
        .slice(0, limit)
        .map(({ userId: _, friendId: __, mirrorId: ___, ...entry }) => ({
          ...entry,
          id: entry._id,
          effectCents: friendDelta(entry),
        })),
      hasMore: rows.length > limit,
    }
  },
})

// Sends a friend request from `friend` (which must have an email) to that
// address. The recipient sees it in their notifications, now or once they
// sign up with that email.
async function sendRequest(ctx: MutationCtx, me: User, friend: Doc<'friends'>) {
  if (!friend.email) throw new ConvexError('Add their email to send a friend request.')
  if (friend.linkedUserId) throw new ConvexError('You’re already connected.')
  if (!me.email) throw new ConvexError('Your account has no email address.')
  if (friend.email === me.email) {
    throw new ConvexError('That’s your own email address.')
  }
  const existing = await ctx.db
    .query('friendRequests')
    .withIndex('by_fromFriendId', (q) => q.eq('fromFriendId', friend._id))
    .take(20)
  for (const old of existing) {
    if (old.status === 'pending') return
  }
  await ctx.db.insert('friendRequests', {
    fromUserId: me.userId,
    fromName: me.name,
    fromEmail: me.email,
    fromFriendId: friend._id,
    toEmail: friend.email,
    status: 'pending',
  })
  await ctx.db.patch('friends', friend._id, { request: 'pending' })
}

/**
 * Adds a friend. With an email, it also sends them a friend request; once
 * they accept, you both see the same one-on-one ledger.
 */
export const create = mutation({
  args: { name: v.string(), email: v.optional(v.string()) },
  handler: async (ctx, args): Promise<Id<'friends'>> => {
    const me = await requireUser(ctx)
    const name = input.text(args.name, 'Name', 60)
    const email = input.email(args.email)

    const existing = await ctx.db
      .query('friends')
      .withIndex('by_userId', (q) => q.eq('userId', me.userId))
      .take(MAX_FRIENDS)
    if (existing.length >= MAX_FRIENDS) {
      throw new ConvexError(`You can have up to ${MAX_FRIENDS} friends.`)
    }
    if (existing.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
      throw new ConvexError(`You already have a friend called ${name}.`)
    }
    if (email && existing.some((f) => f.email === email)) {
      throw new ConvexError(`You already have a friend with the email ${email}.`)
    }
    if (email && email === me.email) {
      throw new ConvexError('That’s your own email address.')
    }

    const friendId = await ctx.db.insert('friends', {
      userId: me.userId,
      name,
      email,
      balances: {},
      lastActivityAt: Date.now(),
    })
    if (email) {
      const friend = await ctx.db.get('friends', friendId)
      await sendRequest(ctx, me, friend!)
    }
    return friendId
  },
})

/** Sends (or re-sends after a decline) a friend request to a friend's email. */
export const requestLink = mutation({
  args: { friendId: v.id('friends') },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    const friend = await requireFriend(ctx, me.userId, args.friendId)
    await sendRequest(ctx, me, friend)
    return null
  },
})

/**
 * Deletes a friend and your ledger with them. If you were linked, they keep
 * their copy of the history as an unlinked friend.
 */
export const remove = mutation({
  args: { friendId: v.id('friends') },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const friend = await requireFriend(ctx, userId, args.friendId)

    const counterpart = await linkedCounterpart(ctx, friend)
    if (counterpart) {
      await ctx.db.patch('friends', counterpart._id, {
        linkedUserId: undefined,
        counterpartId: undefined,
      })
      await ctx.scheduler.runAfter(0, internal.friends.clearMirrors, {
        friendId: counterpart._id,
      })
    }
    const requests = await ctx.db
      .query('friendRequests')
      .withIndex('by_fromFriendId', (q) => q.eq('fromFriendId', friend._id))
      .take(50)
    for (const request of requests) await ctx.db.delete('friendRequests', request._id)

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

/** After an unlink: the entries' twins are gone, so forget them. */
export const clearMirrors = internalMutation({
  args: { friendId: v.id('friends'), cursor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query('friendEntries')
      .withIndex('by_friendId_and_date', (q) => q.eq('friendId', args.friendId))
      .paginate({ numItems: 200, cursor: args.cursor ?? null })
    for (const row of page.page) {
      if (row.mirrorId) await ctx.db.patch('friendEntries', row._id, { mirrorId: undefined })
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.friends.clearMirrors, {
        friendId: args.friendId,
        cursor: page.continueCursor,
      })
    }
    return null
  },
})

// Records an entry in your ledger and, if you're linked, in theirs (with a
// notification saying what it means for them).
async function record(
  ctx: MutationCtx,
  me: User,
  friend: Doc<'friends'>,
  entry: NewEntry,
) {
  const entryId = await ctx.db.insert('friendEntries', entry)
  const now = Date.now()
  await ctx.db.patch('friends', friend._id, {
    balances: addToBalance(friend.balances, entry.currency, friendDelta(entry)),
    lastActivityAt: now,
  })

  const counterpart = await linkedCounterpart(ctx, friend)
  if (!counterpart) return
  const { twin } = await mirrorEntry(ctx, entryId, entry, counterpart)
  const theirDelta = friendDelta(twin)
  await ctx.db.patch('friends', counterpart._id, {
    balances: addToBalance(counterpart.balances, twin.currency, theirDelta),
    lastActivityAt: now,
  })
  await notify(ctx, {
    userId: counterpart.userId,
    kind: entry.kind === 'expense' ? 'friend_expense' : 'friend_payment',
    actorName: me.name,
    description: entry.kind === 'expense' ? entry.description : entry.note,
    amountCents: theirDelta,
    currency: entry.currency,
    friendId: counterpart._id,
  })
}

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
    const me = await requireUser(ctx)
    const friend = await requireFriend(ctx, me.userId, args.friendId)
    await record(ctx, me, friend, {
      kind: 'expense',
      userId: me.userId,
      friendId: friend._id,
      description: input.text(args.description, 'Description', 80),
      amountCents: input.amount(args.amountCents),
      currency: args.currency,
      category: args.category,
      paidBy: args.paidBy,
      split: args.split,
      date: input.isoDate(args.date),
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
    const me = await requireUser(ctx)
    const friend = await requireFriend(ctx, me.userId, args.friendId)
    await record(ctx, me, friend, {
      kind: 'payment',
      userId: me.userId,
      friendId: friend._id,
      amountCents: input.amount(args.amountCents),
      currency: args.currency,
      paidBy: args.paidBy,
      note: input.optionalText(args.note, 'Note', 80),
      date: input.isoDate(args.date),
    })
    return null
  },
})

/** Deletes an entry, and its twin in a linked friend's ledger. */
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

    const twin = entry.mirrorId ? await ctx.db.get('friendEntries', entry.mirrorId) : null
    if (twin && twin.mirrorId === entry._id) {
      const theirFriend = await ctx.db.get('friends', twin.friendId)
      await ctx.db.delete('friendEntries', twin._id)
      if (theirFriend) {
        await ctx.db.patch('friends', theirFriend._id, {
          balances: addToBalance(theirFriend.balances, twin.currency, -friendDelta(twin)),
        })
      }
    }
    return null
  },
})
