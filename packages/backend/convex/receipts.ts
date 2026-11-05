import { ConvexError, v } from 'convex/values'

import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { internalMutation, mutation, query, type QueryCtx } from './_generated/server'
import { findGroup } from './groups'
import { requireUser } from './lib/auth'
import { MAX_RECEIPT_BYTES, RECEIPT_TYPES, deleteReceipt } from './lib/receipts'

// Uploading a receipt takes three steps from the browser: get an upload URL,
// POST the file to it, then `create` a receipt from the returned storage id.
// The form keeps the receipt id and sends it with the expense.

// How long an uploaded receipt may stay unattached (the form was abandoned).
const UNATTACHED_TTL_MS = 24 * 60 * 60 * 1000

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx)
    return await ctx.storage.generateUploadUrl()
  },
})

/**
 * Checks an uploaded file and records it as the caller's receipt. A file
 * that isn't an allowed type or size is deleted, and the reason returned
 * rather than thrown: throwing would roll back the delete too.
 */
export const create = mutation({
  args: { storageId: v.id('_storage'), fileName: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{ receiptId: Id<'receipts'>; error: null } | { receiptId: null; error: string }> => {
    const { userId } = await requireUser(ctx)
    const file = await ctx.db.system.get('_storage', args.storageId)
    if (!file) throw new ConvexError('The upload didn’t finish. Try again.')
    const claimed = await ctx.db
      .query('receipts')
      .withIndex('by_storageId', (q) => q.eq('storageId', args.storageId))
      .unique()
    if (claimed) throw new ConvexError('That file is already attached.')

    const contentType = file.contentType ?? ''
    const error = !(RECEIPT_TYPES as ReadonlyArray<string>).includes(contentType)
      ? 'Receipts must be an image (JPEG, PNG, WebP or GIF) or a PDF.'
      : file.size > MAX_RECEIPT_BYTES
        ? 'Receipts can be up to 10 MB.'
        : null
    if (error) {
      await ctx.storage.delete(args.storageId)
      return { receiptId: null, error }
    }

    const receiptId = await ctx.db.insert('receipts', {
      userId,
      storageId: args.storageId,
      fileName: args.fileName.trim().slice(0, 120) || 'Receipt',
      contentType,
      size: file.size,
      attached: false,
    })
    await ctx.scheduler.runAfter(UNATTACHED_TTL_MS, internal.receipts.discardIfUnattached, {
      receiptId,
    })
    return { receiptId, error: null }
  },
})

/** Deletes a receipt that was uploaded but not attached (the form dropped it). */
export const discard = mutation({
  args: { receiptId: v.id('receipts') },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const receipt = await ctx.db.get('receipts', args.receiptId)
    if (receipt && receipt.userId === userId && !receipt.attached) {
      await deleteReceipt(ctx, receipt._id)
    }
    return null
  },
})

export const discardIfUnattached = internalMutation({
  args: { receiptId: v.id('receipts') },
  handler: async (ctx, args) => {
    const receipt = await ctx.db.get('receipts', args.receiptId)
    if (receipt && !receipt.attached) await deleteReceipt(ctx, receipt._id)
    return null
  },
})

// The expense `expenseId` from `source`, if the caller can see it.
async function findExpense(ctx: QueryCtx, userId: string, source: string, expenseId: string) {
  if (source === 'personal') {
    const id = ctx.db.normalizeId('personalExpenses', expenseId)
    const expense = id ? await ctx.db.get('personalExpenses', id) : null
    if (!expense || expense.userId !== userId) return null
    return { ...expense, source: 'personal' as const, backId: null }
  }
  if (source === 'friend') {
    const id = ctx.db.normalizeId('friendEntries', expenseId)
    const entry = id ? await ctx.db.get('friendEntries', id) : null
    if (!entry || entry.userId !== userId || entry.kind !== 'expense') return null
    return { ...entry, source: 'friend' as const, backId: entry.friendId as string }
  }
  if (source === 'group') {
    const id = ctx.db.normalizeId('groupExpenses', expenseId)
    const expense = id ? await ctx.db.get('groupExpenses', id) : null
    const group = expense ? await findGroup(ctx, userId, expense.groupId) : null
    if (!expense || !group) return null
    return {
      ...expense,
      currency: group.currency,
      source: 'group' as const,
      backId: group._id as string,
    }
  }
  return null
}

/**
 * An expense's receipt, for the receipt page: a URL to the file plus the
 * expense it belongs to. Null if the expense is missing, not the caller's
 * or has no receipt. Takes strings so bad URLs become a 404.
 */
export const forExpense = query({
  args: { source: v.string(), expenseId: v.string() },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const expense = await findExpense(ctx, userId, args.source, args.expenseId)
    const receipt = expense?.receiptId ? await ctx.db.get('receipts', expense.receiptId) : null
    const url = receipt ? await ctx.storage.getUrl(receipt.storageId) : null
    if (!expense || !receipt || !url) return null
    return {
      url,
      fileName: receipt.fileName,
      contentType: receipt.contentType,
      size: receipt.size,
      isPdf: receipt.contentType === 'application/pdf',
      expense: {
        source: expense.source,
        // Where "back" goes: the friend or group the expense is in.
        parentId: expense.backId,
        description: expense.description,
        amountCents: expense.amountCents,
        currency: expense.currency,
        category: expense.category,
        date: expense.date,
      },
    }
  },
})
