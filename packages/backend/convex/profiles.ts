import { v } from 'convex/values'

import { env, mutation, query, type MutationCtx } from './_generated/server'
import { requireUser } from './lib/auth'
import * as input from './lib/input'
import { profileOf } from './lib/profile'
import { newToken } from './lib/tokens'

// Account settings kept on the server (unlike the browser-only defaults):
// your UPI id, the weekly digest and your email inbox address.

/** Your settings, with defaults when you haven't saved any. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireUser(ctx)
    const profile = await profileOf(ctx, userId)
    const domain = env.INBOUND_EMAIL_DOMAIN
    return {
      upiId: profile?.upiId ?? null,
      weeklyDigest: profile?.weeklyDigest ?? false,
      inboxAddress:
        profile?.inboxToken && domain ? `${profile.inboxToken}@${domain}` : null,
      inboxAvailable: Boolean(domain),
    }
  },
})

async function upsert(
  ctx: MutationCtx,
  me: Awaited<ReturnType<typeof requireUser>>,
  patch: { upiId?: string; weeklyDigest?: boolean; inboxToken?: string },
) {
  const profile = await profileOf(ctx, me.userId)
  if (profile) {
    await ctx.db.patch('profiles', profile._id, { ...patch, name: me.name, email: me.email })
  } else {
    await ctx.db.insert('profiles', { userId: me.userId, name: me.name, email: me.email, ...patch })
  }
}

export const update = mutation({
  args: { upiId: v.union(v.string(), v.null()), weeklyDigest: v.boolean() },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    await upsert(ctx, me, {
      upiId: args.upiId === null ? undefined : input.upiId(args.upiId),
      weeklyDigest: args.weeklyDigest || undefined,
    })
    return null
  },
})

/** Creates (or replaces, so the old one stops working) your inbox address. */
export const resetInbox = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx)
    await upsert(ctx, me, { inboxToken: newToken(8) })
    return null
  },
})
