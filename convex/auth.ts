import { createClient, type GenericCtx } from '@convex-dev/better-auth'
import { convex } from '@convex-dev/better-auth/plugins'
import { APIError } from 'better-auth/api'
import { betterAuth, type BetterAuthOptions } from 'better-auth/minimal'
import { emailOTP } from 'better-auth/plugins/email-otp'

import { components } from './_generated/api'
import type { DataModel } from './_generated/dataModel'
import { env, query } from './_generated/server'
import authConfig from './auth.config'
import { sendSignInCode } from './email'

// Better Auth runs inside Convex (its tables live in the betterAuth
// component). The web app reaches it through the /api/auth/* proxy route.
export const authComponent = createClient<DataModel>(components.betterAuth)

// Same limit as `profileName` in src/lib/schemas.ts.
const NAME_MAX_LENGTH = 80

const google =
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        // Take the name (and photo) from the Google account on every Google
        // sign-in, including when it links to an email-code account.
        overrideUserInfoOnSignIn: true,
      }
    : undefined

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth({
    baseURL: env.SITE_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: authComponent.adapter(ctx),
    socialProviders: google ? { google } : {},
    account: {
      // Signing in with Google and with an email code for the same verified
      // address lands on one account.
      accountLinking: { enabled: true, trustedProviders: ['google'] },
    },
    databaseHooks: {
      user: {
        update: {
          // Names people type in (through `updateUser`) are trimmed and
          // checked here too, not only in the browser. Updates made by
          // Google sign-in are left alone.
          async before(user, ctx) {
            if (ctx?.path !== '/update-user' || user.name === undefined) return
            const name = user.name.trim()
            if (!name || name.length > NAME_MAX_LENGTH) {
              throw new APIError('BAD_REQUEST', {
                message: `Enter your full name (up to ${NAME_MAX_LENGTH} characters).`,
              })
            }
            return { data: { ...user, name } }
          },
        },
      },
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 5 * 60,
        async sendVerificationOTP({ email, otp }) {
          await sendSignInCode({ to: email, otp })
        },
      }),
      convex({ authConfig }),
    ],
  } satisfies BetterAuthOptions)

// The signed-in user, or null when signed out.
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return (await authComponent.safeGetAuthUser(ctx)) ?? null
  },
})
