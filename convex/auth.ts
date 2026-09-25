import { createClient, type GenericCtx } from '@convex-dev/better-auth'
import { convex } from '@convex-dev/better-auth/plugins'
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

const google =
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
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
