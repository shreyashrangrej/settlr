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
import { flip, linkedCounterpart, mirrorEntry, type NewEntry } from './lib/friendship'
import * as input from './lib/input'
import { addToBalance, friendDelta, myFriendShare, settleUp } from './lib/ledger'
import { notify } from './lib/notify'
import { profileOf } from './lib/profile'
import { attachReceipt, deleteReceipt } from './lib/receipts'
import { category, currency } from './lib/validators'
import { findGroup, insertGroupPayment, myGroups, viewerMemberId } from './groups'

const MAX_FRIENDS = 500
const paidBy = v.union(v.literal('me'), v.literal('friend'))
const split = v.union(v.literal('equal'), v.literal('full'), v.literal('exact'))
// One reminder a day per friend.
const REMIND_EVERY_MS = 20 * 60 * 60 * 1000

export type User = Awaited<ReturnType<typeof requireUser>>

// The caller's friend, or null if the id is malformed, missing or someone
// else's. Taking a string (not v.id) lets pages turn bad URLs into a 404.
async function findFriend(ctx: QueryCtx, userId: string, friendId: string) {
  const id = ctx.db.normalizeId('friends', friendId)
  const friend = id ? await ctx.db.get('friends', id) : null
  return friend && friend.userId === userId ? friend : null
}

export async function requireFriend(ctx: QueryCtx, userId: string, friendId: string) {
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
    if (!friend) return null
    // A linked friend's own UPI id wins over the one you typed in.
    const theirProfile = friend.linkedUserId ? await profileOf(ctx, friend.linkedUserId) : null
    return {
      ...toFriend(friend),
      upiId: theirProfile?.upiId ?? friend.upiId ?? null,
      ownUpiId: friend.upiId ?? null,
      canRemindAt: (friend.lastRemindedAt ?? 0) + REMIND_EVERY_MS,
    }
  },
})

/**
 * Where you stand with a linked friend across everything: your one-on-one
 * balance plus, for each group you're both in, what the settle-up plan has
 * one of you paying the other. Positive: they owe you.
 */
export const overview = query({
  args: { friendId: v.string() },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const friend = await findFriend(ctx, userId, args.friendId)
    if (!friend) return null
    const groups: Array<{
      groupId: Id<'groups'>
      name: string
      currency: Doc<'groups'>['currency']
      cents: number
    }> = []
    if (friend.linkedUserId) {
      for (const group of await myGroups(ctx, userId)) {
        const me = viewerMemberId(group, userId)
        const them = viewerMemberId(group, friend.linkedUserId)
        if (!me || !them) continue
        let cents = 0
        for (const s of settleUp(group.members)) {
          if (s.from === them && s.to === me) cents += s.amountCents
          if (s.from === me && s.to === them) cents -= s.amountCents
        }
        if (cents !== 0) {
          groups.push({ groupId: group._id, name: group.name, currency: group.currency, cents })
        }
      }
    }
    const totals: Record<string, number> = { ...friend.balances }
    for (const g of groups) totals[g.currency] = (totals[g.currency] ?? 0) + g.cents
    return {
      linked: Boolean(friend.linkedUserId),
      direct: friend.balances,
      groups,
      totals: Object.fromEntries(Object.entries(totals).filter(([, c]) => c !== 0)),
    }
  },
})

// The most ledger rows `summary` reads for one friend.
const MAX_SUMMARY_ENTRIES = 2000

/**
 * A friend's figures for the top of their page, per currency (largest
 * first): how many expenses you've shared, what they came to and what your
 * share was. Payments aren't expenses, so they're left out. Null if the
 * friend is missing or not yours.
 */
export const summary = query({
  args: { friendId: v.string() },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const friend = await findFriend(ctx, userId, args.friendId)
    if (!friend) return null
    const rows = await ctx.db
      .query('friendEntries')
      .withIndex('by_friendId_and_date', (q) => q.eq('friendId', friend._id))
      .take(MAX_SUMMARY_ENTRIES + 1)
    const totals = new Map<
      Doc<'friendEntries'>['currency'],
      { count: number; totalCents: number; shareCents: number }
    >()
    for (const e of rows.slice(0, MAX_SUMMARY_ENTRIES)) {
      if (e.kind !== 'expense') continue
      const row = totals.get(e.currency) ?? { count: 0, totalCents: 0, shareCents: 0 }
      row.count += 1
      row.totalCents += e.amountCents
      row.shareCents += myFriendShare(e)
      totals.set(e.currency, row)
    }
    return {
      totals: [...totals]
        .map(([currency, row]) => ({ currency, ...row }))
        .sort((a, b) => b.totalCents - a.totalCents),
      truncated: rows.length > MAX_SUMMARY_ENTRIES,
    }
  },
})

/**
 * The one-on-one ledger with a friend, filtered and sorted like a group's
 * expenses, as a "show more" list: up to `limit` rows and whether there are
 * more. Payments have no category or description, so a category or a
 * search leaves them out.
 */
export const entries = query({
  args: {
    friendId: v.string(),
    q: v.string(),
    category: v.union(v.literal('all'), category),
    paidBy: v.union(v.literal(''), paidBy),
    sort: v.union(v.literal('date'), v.literal('amount')),
    order: v.union(v.literal('desc'), v.literal('asc')),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const friend = await findFriend(ctx, userId, args.friendId)
    if (!friend) return { items: [], hasMore: false }
    const limit = input.listLimit(args.limit)
    const q = args.q.trim().slice(0, 100)

    let rows: Array<Doc<'friendEntries'>>
    if (q) {
      // Text search ranks by relevance; the requested sort is applied to
      // the matches that come back.
      rows = await ctx.db
        .query('friendEntries')
        .withSearchIndex('search_description', (s) => {
          let search = s.search('description', q).eq('friendId', friend._id)
          if (args.category !== 'all') search = search.eq('category', args.category)
          if (args.paidBy) search = search.eq('paidBy', args.paidBy)
          return search
        })
        .take(limit + 1)
      const dir = args.order === 'asc' ? 1 : -1
      rows.sort((a, b) =>
        args.sort === 'amount'
          ? (a.amountCents - b.amountCents) * dir
          : a.date.localeCompare(b.date) * dir,
      )
    } else {
      const indexed =
        args.sort === 'amount'
          ? ctx.db
              .query('friendEntries')
              .withIndex('by_friendId_and_amountCents', (i) =>
                i.eq('friendId', friend._id),
              )
          : ctx.db
              .query('friendEntries')
              .withIndex('by_friendId_and_date', (i) => i.eq('friendId', friend._id))
      rows = await indexed
        .order(args.order)
        .filter((f) =>
          f.and(
            args.category === 'all'
              ? true
              : f.eq(f.field('category'), args.category),
            args.paidBy ? f.eq(f.field('paidBy'), args.paidBy) : true,
          ),
        )
        .take(limit + 1)
    }

    return {
      items: rows
        .slice(0, limit)
        .map(({ userId: _, friendId: __, mirrorId: ___, ...entry }) => ({
          ...entry,
          id: entry._id,
          effectCents: friendDelta(entry),
          // You received it and someone else said they paid it.
          canConfirm:
            entry.kind === 'payment' &&
            Boolean(entry.unconfirmed) &&
            entry.recordedBy !== userId,
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
    for (const row of batch) {
      await ctx.db.delete('friendEntries', row._id)
      // A linked friend's twin keeps a shared receipt alive.
      if (row.kind === 'expense' && row.receiptId) {
        const twin = row.mirrorId ? await ctx.db.get('friendEntries', row.mirrorId) : null
        if (twin?.kind !== 'expense' || twin.receiptId !== row.receiptId) {
          await deleteReceipt(ctx, row.receiptId)
        }
      }
    }
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

// The amount and split of a one-on-one expense, checked.
export function checkSplit(args: {
  amountCents: number
  split: 'equal' | 'full' | 'exact'
  owedCents?: number
}) {
  const amountCents = input.amount(args.amountCents)
  if (args.split !== 'exact') return { amountCents, split: args.split, owedCents: undefined }
  const owed = args.owedCents ?? -1
  if (!Number.isInteger(owed) || owed < 0 || owed > amountCents) {
    throw new ConvexError('What they owe must be between zero and the amount.')
  }
  return { amountCents, split: args.split, owedCents: owed }
}

// Records an entry in your ledger and, if you're linked, in theirs (with a
// notification saying what it means for them).
export async function record(
  ctx: MutationCtx,
  me: User,
  friend: Doc<'friends'>,
  input: NewEntry,
) {
  const counterpartFirst = await linkedCounterpart(ctx, friend)
  // A payment you say you made to a linked friend waits for them to
  // confirm it (the balance moves now; rejecting it moves it back).
  const entry: NewEntry =
    input.kind === 'payment'
      ? {
          ...input,
          recordedBy: me.userId,
          unconfirmed: counterpartFirst && input.paidBy === 'me' ? true : undefined,
        }
      : input
  const entryId = await ctx.db.insert('friendEntries', entry)
  const now = Date.now()
  await ctx.db.patch('friends', friend._id, {
    balances: addToBalance(friend.balances, entry.currency, friendDelta(entry)),
    lastActivityAt: now,
  })

  const counterpart = await linkedCounterpart(ctx, friend)
  if (!counterpart) return entryId
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
    description:
      entry.kind === 'expense'
        ? entry.description
        : entry.unconfirmed
          ? `${entry.note ? `${entry.note} · ` : ''}Confirm you got it`
          : entry.note,
    amountCents: theirDelta,
    currency: entry.currency,
    friendId: counterpart._id,
  })
  return entryId
}

export const addExpense = mutation({
  args: {
    friendId: v.id('friends'),
    description: v.string(),
    amountCents: v.number(),
    currency,
    category,
    paidBy,
    split,
    // With split 'exact': what the person who didn't pay owes.
    owedCents: v.optional(v.number()),
    date: v.string(),
    receiptId: v.optional(v.id('receipts')),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args): Promise<Id<'friendEntries'>> => {
    const me = await requireUser(ctx)
    const friend = await requireFriend(ctx, me.userId, args.friendId)
    const receiptId = await attachReceipt(ctx, me.userId, args.receiptId)
    return await record(ctx, me, friend, {
      kind: 'expense',
      userId: me.userId,
      friendId: friend._id,
      description: input.text(args.description, 'Description', 80),
      ...checkSplit(args),
      currency: args.currency,
      category: args.category,
      paidBy: args.paidBy,
      date: input.isoDate(args.date),
      receiptId,
      tags: input.tags(args.tags),
    })
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

async function requireEntry(ctx: QueryCtx, userId: string, entryId: Id<'friendEntries'>) {
  const entry = await ctx.db.get('friendEntries', entryId)
  if (!entry || entry.userId !== userId) {
    throw new ConvexError('That entry doesn’t exist.')
  }
  return entry
}

// The entry's twin in a linked friend's ledger, if it's still paired.
async function twinOf(ctx: QueryCtx, entry: Doc<'friendEntries'>) {
  const twin = entry.mirrorId ? await ctx.db.get('friendEntries', entry.mirrorId) : null
  return twin && twin.mirrorId === entry._id ? twin : null
}

// Replaces an entry with `next` in your ledger and, if linked, its twin in
// theirs, moving both balances and telling them what changed.
async function replaceEntry(
  ctx: MutationCtx,
  me: User,
  entry: Doc<'friendEntries'>,
  next: NewEntry,
) {
  const friend = await requireFriend(ctx, me.userId, entry.friendId)
  const now = Date.now()
  await ctx.db.replace('friendEntries', entry._id, next)
  const balances = addToBalance(friend.balances, entry.currency, -friendDelta(entry))
  await ctx.db.patch('friends', friend._id, {
    balances: addToBalance(balances, next.currency, friendDelta(next)),
    lastActivityAt: now,
  })

  const twin = await twinOf(ctx, entry)
  const theirFriend = twin ? await ctx.db.get('friends', twin.friendId) : null
  if (!twin || !theirFriend) return
  const nextTwin = { ...flip(next, theirFriend), mirrorId: entry._id }
  await ctx.db.replace('friendEntries', twin._id, nextTwin)
  const theirs = addToBalance(theirFriend.balances, twin.currency, -friendDelta(twin))
  const theirDelta = friendDelta(nextTwin)
  await ctx.db.patch('friends', theirFriend._id, {
    balances: addToBalance(theirs, nextTwin.currency, theirDelta),
    lastActivityAt: now,
  })
  await notify(ctx, {
    userId: theirFriend.userId,
    kind: 'friend_entry_updated',
    actorName: me.name,
    description: next.kind === 'expense' ? next.description : next.note,
    amountCents: theirDelta,
    currency: next.currency,
    friendId: theirFriend._id,
  })
}

/**
 * Edits an expense (and its twin, if you're linked). `receiptId` is the
 * receipt it should end up with.
 */
export const updateExpense = mutation({
  args: {
    entryId: v.id('friendEntries'),
    description: v.string(),
    amountCents: v.number(),
    currency,
    category,
    paidBy,
    split,
    owedCents: v.optional(v.number()),
    date: v.string(),
    receiptId: v.union(v.id('receipts'), v.null()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    const entry = await requireEntry(ctx, me.userId, args.entryId)
    if (entry.kind !== 'expense') throw new ConvexError('That entry is a payment.')
    await replaceEntry(ctx, me, entry, {
      kind: 'expense',
      userId: entry.userId,
      friendId: entry.friendId,
      description: input.text(args.description, 'Description', 80),
      ...checkSplit(args),
      currency: args.currency,
      category: args.category,
      paidBy: args.paidBy,
      date: input.isoDate(args.date),
      mirrorId: entry.mirrorId,
      receiptId: await attachReceipt(ctx, me.userId, args.receiptId, entry.receiptId),
      tags: input.tags(args.tags),
      recurringId: entry.recurringId,
    })
    return null
  },
})

/** Edits a settle-up payment (and its twin, if you're linked). */
export const updatePayment = mutation({
  args: {
    entryId: v.id('friendEntries'),
    amountCents: v.number(),
    currency,
    paidBy,
    note: v.optional(v.string()),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    const entry = await requireEntry(ctx, me.userId, args.entryId)
    if (entry.kind !== 'payment') throw new ConvexError('That entry is an expense.')
    await replaceEntry(ctx, me, entry, {
      kind: 'payment',
      userId: entry.userId,
      friendId: entry.friendId,
      amountCents: input.amount(args.amountCents),
      currency: args.currency,
      paidBy: args.paidBy,
      note: input.optionalText(args.note, 'Note', 80),
      date: input.isoDate(args.date),
      mirrorId: entry.mirrorId,
      recordedBy: entry.recordedBy,
      unconfirmed: entry.unconfirmed,
    })
    return null
  },
})

// Deletes an entry and its twin in a linked friend's ledger, moving both
// balances back. Receipts are left to the caller.
async function deleteEntryPair(ctx: MutationCtx, entry: Doc<'friendEntries'>) {
  const friend = await ctx.db.get('friends', entry.friendId)
  await ctx.db.delete('friendEntries', entry._id)
  if (friend) {
    await ctx.db.patch('friends', friend._id, {
      balances: addToBalance(friend.balances, entry.currency, -friendDelta(entry)),
    })
  }
  const twin = await twinOf(ctx, entry)
  if (twin) {
    const theirFriend = await ctx.db.get('friends', twin.friendId)
    await ctx.db.delete('friendEntries', twin._id)
    if (theirFriend) {
      await ctx.db.patch('friends', theirFriend._id, {
        balances: addToBalance(theirFriend.balances, twin.currency, -friendDelta(twin)),
      })
    }
  }
}

/**
 * Deletes an entry, and its twin in a linked friend's ledger. An expense
 * goes to your trash (restorable for 30 days; its trash row is returned for
 * the toast's Undo); a payment is deleted outright.
 */
export const removeEntry = mutation({
  args: { entryId: v.id('friendEntries') },
  handler: async (ctx, args): Promise<Id<'trash'> | null> => {
    const { userId } = await requireUser(ctx)
    const entry = await requireEntry(ctx, userId, args.entryId)
    const friend = await requireFriend(ctx, userId, entry.friendId)
    await deleteEntryPair(ctx, entry)
    if (entry.kind !== 'expense') return null
    return await ctx.db.insert('trash', {
      userId,
      description: entry.description,
      amountCents: entry.amountCents,
      currency: entry.currency,
      where: friend.name,
      item: {
        kind: 'friend',
        friendId: friend._id,
        expense: {
          description: entry.description,
          amountCents: entry.amountCents,
          currency: entry.currency,
          category: entry.category,
          paidBy: entry.paidBy,
          split: entry.split,
          owedCents: entry.owedCents,
          date: entry.date,
          receiptId: entry.receiptId,
          tags: entry.tags,
          recurringId: entry.recurringId,
        },
      },
    })
  },
})

/**
 * The friend who got a payment answers it: confirming keeps it, rejecting
 * ("I never got it") deletes it from both ledgers. They're told either way.
 */
export const answerPayment = mutation({
  args: { entryId: v.id('friendEntries'), confirm: v.boolean() },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    const entry = await requireEntry(ctx, me.userId, args.entryId)
    if (entry.kind !== 'payment' || !entry.unconfirmed || entry.recordedBy === me.userId) {
      throw new ConvexError('There’s nothing to confirm on that entry.')
    }
    const twin = await twinOf(ctx, entry)
    if (args.confirm) {
      await ctx.db.patch('friendEntries', entry._id, { unconfirmed: undefined })
      if (twin) await ctx.db.patch('friendEntries', twin._id, { unconfirmed: undefined })
    } else {
      await deleteEntryPair(ctx, entry)
    }
    if (twin) {
      await notify(ctx, {
        userId: twin.userId,
        kind: args.confirm ? 'payment_confirmed' : 'payment_rejected',
        actorName: me.name,
        amountCents: entry.amountCents,
        currency: entry.currency,
        friendId: twin.friendId,
      })
    }
    return null
  },
})

/**
 * Reminds a friend who owes you: a notification if they're linked, an email
 * if they're not but you have their address. Once a day at most.
 */
export const remind = mutation({
  args: { friendId: v.id('friends') },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    const friend = await requireFriend(ctx, me.userId, args.friendId)
    const owed = Object.entries(friend.balances).filter(([, cents]) => cents > 0)
    if (owed.length === 0) throw new ConvexError(`${friend.name} doesn’t owe you anything.`)
    const now = Date.now()
    if ((friend.lastRemindedAt ?? 0) + REMIND_EVERY_MS > now) {
      throw new ConvexError(`You already reminded ${friend.name} today.`)
    }
    const counterpart = await linkedCounterpart(ctx, friend)
    if (counterpart) {
      for (const [code, cents] of owed) {
        await notify(ctx, {
          userId: counterpart.userId,
          kind: 'reminder',
          actorName: me.name,
          description: `You owe ${me.name}`,
          amountCents: cents,
          currency: code as Doc<'friendEntries'>['currency'],
          friendId: counterpart._id,
        })
      }
    } else if (friend.email) {
      await ctx.scheduler.runAfter(0, internal.notifyEmail.reminder, {
        to: friend.email,
        fromName: me.name,
        friendName: friend.name,
        amounts: owed.map(([code, cents]) => ({
          currency: code as Doc<'friendEntries'>['currency'],
          cents,
        })),
      })
    } else {
      throw new ConvexError(`Add ${friend.name}’s email, or connect with them, to send a reminder.`)
    }
    await ctx.db.patch('friends', friend._id, { lastRemindedAt: now })
    return counterpart ? 'notification' : 'email'
  },
})

/** Saves the UPI id you pay this friend at (when they haven't set their own). */
export const setUpi = mutation({
  args: { friendId: v.id('friends'), upiId: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const friend = await requireFriend(ctx, userId, args.friendId)
    await ctx.db.patch('friends', friend._id, {
      upiId: args.upiId === null ? undefined : input.upiId(args.upiId),
    })
    return null
  },
})

/**
 * Settles everything with a linked friend in one currency: a payment in your
 * one-on-one ledger for that balance, and one in each shared group for what
 * the settle-up plan has between you. Payments you make wait for them to
 * confirm, like any other.
 */
export const settleEverything = mutation({
  args: { friendId: v.id('friends'), currency, date: v.string() },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    const friend = await requireFriend(ctx, me.userId, args.friendId)
    const date = input.isoDate(args.date)
    let count = 0
    const direct = friend.balances[args.currency] ?? 0
    if (direct !== 0) {
      await record(ctx, me, friend, {
        kind: 'payment',
        userId: me.userId,
        friendId: friend._id,
        amountCents: Math.abs(direct),
        currency: args.currency,
        // They owe you: they paid you. You owe them: you paid them.
        paidBy: direct > 0 ? 'friend' : 'me',
        note: 'Settled everything',
        date,
      })
      count++
    }
    if (friend.linkedUserId) {
      for (const group of await myGroups(ctx, me.userId)) {
        if (group.currency !== args.currency) continue
        const mine = viewerMemberId(group, me.userId)
        const theirs = viewerMemberId(group, friend.linkedUserId)
        if (!mine || !theirs) continue
        for (const s of settleUp(group.members)) {
          const between =
            (s.from === mine && s.to === theirs) || (s.from === theirs && s.to === mine)
          if (!between) continue
          const fresh = await findGroup(ctx, me.userId, group._id)
          if (!fresh) continue
          await insertGroupPayment(ctx, me, fresh, { ...s, date })
          count++
        }
      }
    }
    if (count === 0) throw new ConvexError('You’re already settled up.')
    return count
  },
})
