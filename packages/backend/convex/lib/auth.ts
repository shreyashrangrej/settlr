import { ConvexError } from 'convex/values'

import type { QueryCtx } from '../_generated/server'

// The signed-in user, from the Convex JWT that Better Auth issues. Every
// table is scoped by `userId`, which is the identity's `tokenIdentifier`
// (stable per account). Never accept a user id as a function argument.
// `email` (verified by Better Auth: a sign-in code or Google) is how friend
// requests find their recipient.
export async function requireUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new ConvexError('Sign in to continue.')
  return {
    userId: identity.tokenIdentifier,
    // Right after an email sign-up the token may not carry the new name
    // yet; never show other people the word "You" for someone else.
    name: identity.name?.trim() || identity.email?.split('@')[0] || 'Someone',
    email: identity.email?.trim().toLowerCase() ?? '',
  }
}
