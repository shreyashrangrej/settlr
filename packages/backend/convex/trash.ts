import { ConvexError, v } from 'convex/values'

import { internal } from './_generated/api'
import { internalMutation, mutation, query } from './_generated/server'
import { record, requireFriend } from './friends'
import { insertGroupExpense, requireGroup } from './groups'
import { requireUser } from './lib/auth'
import { deleteReceipt } from './lib/receipts'

// Deleted expenses wait here for 30 days (see `trash` in schema.ts). A
// restore puts the expense back through the same code that adds one, so
// balances and totals move back too.

const KEEP_MS = 30 * 24 * 60 * 60 * 1000

/** Your deleted expenses, newest first. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireUser(ctx)
    const rows = await ctx.db
      .query('trash')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .order('desc')
      .take(200)
    return rows.map((row) => ({
      id: row._id,
      deletedAt: row._creationTime,
      expiresAt: row._creationTime + KEEP_MS,
      description: row.description,
      amountCents: row.amountCents,
      currency: row.currency,
      kind: row.item.kind,
      where: row.where ?? null,
      date: row.item.expense.date,
      category: row.item.expense.category,
    }))
  },
})

/** Puts a deleted expense back where it was. */
export const restore = mutation({
  args: { trashId: v.id('trash') },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    const row = await ctx.db.get('trash', args.trashId)
    if (!row || row.userId !== me.userId) {
      throw new ConvexError('That expense is no longer in your trash.')
    }
    const item = row.item
    if (item.kind === 'personal') {
      await ctx.db.insert('personalExpenses', { userId: me.userId, ...item.expense })
    } else if (item.kind === 'friend') {
      const friend = await requireFriend(ctx, me.userId, item.friendId).catch(() => null)
      if (!friend) throw new ConvexError('That friend has been removed, so it can’t come back.')
      await record(ctx, me, friend, {
        kind: 'expense',
        userId: me.userId,
        friendId: friend._id,
        ...item.expense,
      })
    } else {
      const group = await requireGroup(ctx, me.userId, item.groupId).catch(() => null)
      if (!group) throw new ConvexError('That group is gone, so it can’t come back.')
      const ids = new Set(group.members.map((m) => m.id))
      const people = [item.expense.paidBy, ...item.expense.splitAmong]
      if (!people.every((id) => ids.has(id))) {
        throw new ConvexError('Someone on it has left the group, so it can’t come back.')
      }
      await insertGroupExpense(
        ctx,
        me,
        group,
        { groupId: group._id, ...item.expense },
        { quiet: true, restored: true },
      )
    }
    await ctx.db.delete('trash', row._id)
    return item.kind
  },
})

/** Deletes a trashed expense for good, with its receipt. */
export const purge = mutation({
  args: { trashId: v.id('trash') },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const row = await ctx.db.get('trash', args.trashId)
    if (!row || row.userId !== userId) return null
    if (row.item.expense.receiptId) await deleteReceipt(ctx, row.item.expense.receiptId)
    await ctx.db.delete('trash', row._id)
    return null
  },
})

/** Daily: empties trash older than 30 days. */
export const purgeExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - KEEP_MS
    const rows = await ctx.db
      .query('trash')
      .withIndex('by_creation_time', (q) => q.lt('_creationTime', cutoff))
      .take(200)
    for (const row of rows) {
      if (row.item.expense.receiptId) await deleteReceipt(ctx, row.item.expense.receiptId)
      await ctx.db.delete('trash', row._id)
    }
    if (rows.length === 200) await ctx.scheduler.runAfter(0, internal.trash.purgeExpired, {})
    return null
  },
})
