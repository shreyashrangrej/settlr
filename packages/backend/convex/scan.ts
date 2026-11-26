import { ConvexError, v } from 'convex/values'

import { internal } from './_generated/api'
import { action, internalQuery } from './_generated/server'
import { requireUser } from './lib/auth'
import { extractExpense, type Extracted } from './lib/extract'

// "Fill from receipt": reads an uploaded receipt photo with a vision model
// and returns what it found for the form to fill in. Nothing is saved.

export const receiptUrl = internalQuery({
  args: { receiptId: v.id('receipts') },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const receipt = await ctx.db.get('receipts', args.receiptId)
    if (!receipt || receipt.userId !== userId) return null
    if (!receipt.contentType.startsWith('image/')) return { url: null, isImage: false }
    return { url: await ctx.storage.getUrl(receipt.storageId), isImage: true }
  },
})

export const receipt = action({
  args: { receiptId: v.id('receipts') },
  handler: async (ctx, args): Promise<Extracted> => {
    const found = await ctx.runQuery(internal.scan.receiptUrl, args)
    if (!found) throw new ConvexError('That receipt is no longer available.')
    if (!found.isImage || !found.url) {
      throw new ConvexError('Only photos can be read. Fill a PDF in by hand.')
    }
    return await extractExpense(
      [
        { type: 'text', text: 'Here is the receipt.' },
        { type: 'image_url', image_url: { url: found.url } },
      ],
      { vision: true },
    )
  },
})
