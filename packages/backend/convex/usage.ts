import { ConvexError, v } from 'convex/values'

import { internalMutation, type MutationCtx } from './_generated/server'
import { requireUser } from './lib/auth'

// Caps on things that cost money or reach other people's inboxes: AI calls,
// reminder emails and sign-in codes. Each key gets a fixed window.

const HOUR = 60 * 60 * 1000
export const DAY = 24 * HOUR
export const AI_PER_DAY = 100
export const REMINDER_EMAILS_PER_DAY = 20
const SIGN_IN_CODES_PER_HOUR = 5

/**
 * Counts one use of `key`, or returns false (counting nothing) once `max`
 * uses fall in the current window.
 */
export async function withinLimit(ctx: MutationCtx, key: string, max: number, windowMs: number) {
  const now = Date.now()
  const row = await ctx.db
    .query('usage')
    .withIndex('by_key', (q) => q.eq('key', key))
    .unique()
  if (!row) {
    await ctx.db.insert('usage', { key, windowStart: now, count: 1 })
    return true
  }
  if (now - row.windowStart >= windowMs) {
    await ctx.db.patch('usage', row._id, { windowStart: now, count: 1 })
    return true
  }
  if (row.count >= max) return false
  await ctx.db.patch('usage', row._id, { count: row.count + 1 })
  return true
}

/** Counts an assistant message or a receipt scan; throws past the day's cap. */
export const ai = internalMutation({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireUser(ctx)
    if (!(await withinLimit(ctx, `ai:${userId}`, AI_PER_DAY, DAY))) {
      throw new ConvexError(`You’ve used the AI ${AI_PER_DAY} times today. Try again tomorrow.`)
    }
    return null
  },
})

/** Whether another sign-in code may be emailed to `email` this hour. */
export const signInCode = internalMutation({
  args: { email: v.string() },
  // shortcut: one row per address ever asked for; purge old rows if this table grows large.
  handler: async (ctx, args) =>
    await withinLimit(ctx, `signin:${args.email.toLowerCase()}`, SIGN_IN_CODES_PER_HOUR, HOUR),
})
