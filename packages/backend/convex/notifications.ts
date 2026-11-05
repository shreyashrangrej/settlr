import { ConvexError, v } from 'convex/values'

import type { Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import { requireUser } from './lib/auth'
import { ledgerOf, mirrorEntry, recomputeBalances } from './lib/friendship'
import { notify } from './lib/notify'

const PAGE = 50
// The badge shows "99+" past this.
const COUNT_CAP = 99

/**
 * Friend requests waiting for you, and your recent notifications: up to
 * `limit` of each (the header dropdown shows a few, the page a full page).
 */
export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    const take = Math.min(Math.max(Math.floor(args.limit ?? PAGE), 1), PAGE)
    const requests = me.email
      ? await ctx.db
          .query('friendRequests')
          .withIndex('by_toEmail_and_status', (q) =>
            q.eq('toEmail', me.email).eq('status', 'pending'),
          )
          .order('desc')
          .take(take)
      : []
    const items = await ctx.db
      .query('notifications')
      .withIndex('by_userId', (q) => q.eq('userId', me.userId))
      .order('desc')
      .take(take)
    return {
      requests: requests
        // Never show someone their own request (same email on two accounts).
        .filter((r) => r.fromUserId !== me.userId)
        .map((r) => ({
          id: r._id,
          fromName: r.fromName,
          fromEmail: r.fromEmail,
          sentAt: r._creationTime,
        })),
      items: items.map(({ _id, _creationTime, userId: _, ...rest }) => ({
        ...rest,
        id: _id,
        createdAt: _creationTime,
      })),
    }
  },
})

/** Pending friend requests plus unread notifications, for the header bell. */
export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx)
    const requests = me.email
      ? await ctx.db
          .query('friendRequests')
          .withIndex('by_toEmail_and_status', (q) =>
            q.eq('toEmail', me.email).eq('status', 'pending'),
          )
          .take(COUNT_CAP + 1)
      : []
    const unread = await ctx.db
      .query('notifications')
      .withIndex('by_userId_and_read', (q) => q.eq('userId', me.userId).eq('read', false))
      .take(COUNT_CAP + 1)
    const mine = requests.filter((r) => r.fromUserId !== me.userId).length
    return Math.min(mine + unread.length, COUNT_CAP + 1)
  },
})

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx)
    const unread = await ctx.db
      .query('notifications')
      .withIndex('by_userId_and_read', (q) => q.eq('userId', me.userId).eq('read', false))
      .take(500)
    for (const item of unread) await ctx.db.patch('notifications', item._id, { read: true })
    return null
  },
})

async function requireRequest(
  ctx: Parameters<typeof requireUser>[0],
  email: string,
  requestId: Id<'friendRequests'>,
) {
  const request = await ctx.db.get('friendRequests', requestId)
  if (!request || !email || request.toEmail !== email || request.status !== 'pending') {
    throw new ConvexError('That friend request is no longer available.')
  }
  return request
}

/**
 * Accepts a friend request: links the sender's friend row with one of yours
 * (an existing friend with their email, or a new one) and copies each
 * side's history into the other so you both see the same ledger.
 */
export const acceptRequest = mutation({
  args: { requestId: v.id('friendRequests') },
  handler: async (ctx, args): Promise<Id<'friends'>> => {
    const me = await requireUser(ctx)
    const request = await requireRequest(ctx, me.email, args.requestId)
    if (request.fromUserId === me.userId) {
      throw new ConvexError('You can’t accept your own request.')
    }
    const theirs = await ctx.db.get('friends', request.fromFriendId)
    if (!theirs || theirs.linkedUserId) {
      await ctx.db.patch('friendRequests', request._id, { status: 'declined' })
      throw new ConvexError('That friend request is no longer available.')
    }

    const myFriends = await ctx.db
      .query('friends')
      .withIndex('by_userId', (q) => q.eq('userId', me.userId))
      .take(500)
    if (myFriends.some((f) => f.linkedUserId === request.fromUserId)) {
      throw new ConvexError(`You’re already connected with ${request.fromName}.`)
    }
    // Reuse a friend you already track under their email, so your history
    // with them is kept and shared.
    const existing = myFriends.find((f) => !f.linkedUserId && f.email === request.fromEmail)
    const now = Date.now()
    const mineId =
      existing?._id ??
      (await ctx.db.insert('friends', {
        userId: me.userId,
        name: request.fromName,
        email: request.fromEmail,
        balances: {},
        lastActivityAt: now,
      }))

    await ctx.db.patch('friends', theirs._id, {
      linkedUserId: me.userId,
      counterpartId: mineId,
      request: undefined,
      lastActivityAt: now,
    })
    await ctx.db.patch('friends', mineId, {
      linkedUserId: request.fromUserId,
      counterpartId: theirs._id,
      request: undefined,
      lastActivityAt: now,
    })
    const mine = (await ctx.db.get('friends', mineId))!
    const theirsNow = (await ctx.db.get('friends', theirs._id))!

    // Copy history both ways (read both first, then write).
    const theirEntries = (await ledgerOf(ctx, theirs._id)).filter((e) => !e.mirrorId)
    const myEntries = (await ledgerOf(ctx, mineId)).filter((e) => !e.mirrorId)
    for (const entry of theirEntries) await mirrorEntry(ctx, entry._id, entry, mine)
    for (const entry of myEntries) await mirrorEntry(ctx, entry._id, entry, theirsNow)
    await recomputeBalances(ctx, theirs._id)
    await recomputeBalances(ctx, mineId)

    await ctx.db.patch('friendRequests', request._id, { status: 'accepted' })
    // If you'd also sent them a request, it's answered now too.
    const mySent = await ctx.db
      .query('friendRequests')
      .withIndex('by_fromFriendId', (q) => q.eq('fromFriendId', mineId))
      .take(20)
    for (const sent of mySent) {
      if (sent.status === 'pending') {
        await ctx.db.patch('friendRequests', sent._id, { status: 'accepted' })
      }
    }

    await notify(ctx, {
      userId: request.fromUserId,
      kind: 'request_accepted',
      actorName: me.name,
      friendId: theirs._id,
    })
    return mineId
  },
})

export const declineRequest = mutation({
  args: { requestId: v.id('friendRequests') },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    const request = await requireRequest(ctx, me.email, args.requestId)
    await ctx.db.patch('friendRequests', request._id, { status: 'declined' })
    const theirs = await ctx.db.get('friends', request.fromFriendId)
    if (theirs && !theirs.linkedUserId) {
      await ctx.db.patch('friends', theirs._id, { request: 'declined' })
    }
    return null
  },
})
