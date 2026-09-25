import { ConvexError } from 'convex/values'

import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

// Receipts are files in Convex storage with a row in `receipts`. A receipt
// is uploaded first (see receipts.ts), then attached when an expense is
// added or edited. From then on it lives and dies with that expense: a
// linked friend's twin entry shares it, and group members see it through the
// group.

// Browsers can show all of these inline, so the in-app viewer always works.
export const RECEIPT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
] as const
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024

/** Deletes a receipt's file and its row. */
export async function deleteReceipt(ctx: MutationCtx, receiptId: Id<'receipts'>) {
  const receipt = await ctx.db.get('receipts', receiptId)
  if (!receipt) return
  if (await ctx.db.system.get('_storage', receipt.storageId)) {
    await ctx.storage.delete(receipt.storageId)
  }
  await ctx.db.delete('receipts', receipt._id)
}

/**
 * Moves an expense from its `current` receipt to `next` (either may be
 * absent) and returns the id to store. `next` must be an unattached receipt
 * the caller uploaded, unless it's the one already there. A replaced or
 * removed receipt is deleted.
 */
export async function attachReceipt(
  ctx: MutationCtx,
  userId: string,
  next: Id<'receipts'> | null | undefined,
  current?: Id<'receipts'>,
) {
  if (next && next !== current) {
    const receipt = await ctx.db.get('receipts', next)
    if (!receipt || receipt.userId !== userId || receipt.attached) {
      throw new ConvexError('That receipt is no longer available. Attach it again.')
    }
    await ctx.db.patch('receipts', receipt._id, { attached: true })
  }
  if (current && current !== next) await deleteReceipt(ctx, current)
  return next ?? undefined
}
