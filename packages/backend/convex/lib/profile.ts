import type { QueryCtx } from '../_generated/server'

/** A user's profile row, if they've saved one. */
export async function profileOf(ctx: QueryCtx, userId: string) {
  return await ctx.db
    .query('profiles')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .unique()
}

/** The UPI ids of these users (those who've set one). */
export async function upiIds(ctx: QueryCtx, userIds: Array<string>) {
  const result = new Map<string, string>()
  for (const userId of new Set(userIds)) {
    const profile = await profileOf(ctx, userId)
    if (profile?.upiId) result.set(userId, profile.upiId)
  }
  return result
}
