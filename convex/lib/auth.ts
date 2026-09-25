import { ConvexError } from 'convex/values'

import type { QueryCtx } from '../_generated/server'

// The signed-in user, from the Convex JWT that Better Auth issues. Every
// table is scoped by `userId`, which is the identity's `tokenIdentifier`
// (stable per account). Never accept a user id as a function argument.
export async function requireUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new ConvexError('Sign in to continue.')
  return {
    userId: identity.tokenIdentifier,
    name: identity.name?.trim() || 'You',
  }
}
