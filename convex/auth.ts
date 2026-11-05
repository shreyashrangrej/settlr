import { createClient, type GenericCtx } from '@convex-dev/better-auth'
import { convex } from '@convex-dev/better-auth/plugins'
import {
  APIError,
  createAuthEndpoint,
  createAuthMiddleware,
  getSessionFromCtx,
} from 'better-auth/api'
import type { BetterAuthPlugin } from 'better-auth'
import { betterAuth, type BetterAuthOptions } from 'better-auth/minimal'
import { mcp } from 'better-auth/plugins'
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

// Issues the Convex JWTs, for browser sessions and (below) MCP clients.
const convexPlugin = convex({ authConfig })

// MCP clients (Claude, ChatGPT, ...) connect through OAuth: they register
// themselves (/mcp/register), send the user to /mcp/authorize, which has
// them approve on /connect, and trade the code for an access token
// (/mcp/token). The web app's /api/mcp then swaps that token for a Convex
// JWT (/mcp/convex-token) and runs the assistant's tools as the user
// (convex/mcp.ts).
const MCP_SCOPES = ['openid', 'profile', 'email', 'offline_access']

const mcpPlugin = mcp({
  loginPage: `${env.SITE_URL}/connect`,
  resource: `${env.SITE_URL}/api/mcp`,
  oidcConfig: {
    loginPage: `${env.SITE_URL}/connect`,
    consentPage: `${env.SITE_URL}/connect`,
    requirePKCE: true,
    // Each refresh issues a new one, so a connection lasts while it's used.
    refreshTokenExpiresIn: 60 * 60 * 24 * 30,
  },
})

const mcpBridge = {
  id: 'settlr-mcp',
  hooks: {
    before: [
      {
        // Anyone can register a client, so every authorization asks the
        // user first (prompt=consent). Signing in happens on /connect, not
        // through the MCP plugin's login-prompt cookie, which would hand
        // out a code as a side effect of signing in.
        matcher: (ctx) => ctx.path === '/mcp/authorize',
        handler: createAuthMiddleware(async (ctx) => {
          const query: Record<string, string> = {}
          for (const [key, value] of Object.entries(ctx.query ?? {})) {
            if (typeof value === 'string') query[key] = value
          }
          const session = await getSessionFromCtx(ctx)
          if (!session) {
            throw ctx.redirect(`${env.SITE_URL}/connect?${new URLSearchParams(query)}`)
          }
          // Keep the scopes we know, plus offline_access so the client gets
          // a refresh token instead of asking again every hour.
          const scopes = new Set(
            (query.scope ?? '').split(' ').filter((scope) => MCP_SCOPES.includes(scope)),
          )
          scopes.add('openid')
          scopes.add('offline_access')
          return {
            context: { query: { ...query, scope: [...scopes].join(' '), prompt: 'consent' } },
          }
        }),
      },
      {
        // The code the consent page holds isn't approved yet, and the MCP
        // plugin's token endpoint doesn't check that itself.
        matcher: (ctx) => ctx.path === '/mcp/token',
        handler: createAuthMiddleware(async (ctx) => {
          const body: unknown =
            ctx.body instanceof FormData ? Object.fromEntries(ctx.body) : ctx.body
          if (typeof body !== 'object' || body === null) return
          const { grant_type, code } = body as Record<string, unknown>
          if (grant_type !== 'authorization_code' || typeof code !== 'string') return
          const found = await ctx.context.internalAdapter.findVerificationValue(code)
          if (found && JSON.parse(found.value).requireConsent) {
            throw new APIError('UNAUTHORIZED', {
              error: 'invalid_grant',
              error_description: 'This hasn’t been approved yet.',
            })
          }
        }),
      },
    ],
    after: [
      {
        // The MCP plugin issues a new token pair on refresh but leaves the
        // old one usable; retire it so refresh tokens are single-use and
        // grants don't pile up.
        matcher: (ctx) => ctx.path === '/mcp/token',
        handler: createAuthMiddleware(async (ctx) => {
          if (ctx.context.returned instanceof Error) return
          const body: unknown =
            ctx.body instanceof FormData ? Object.fromEntries(ctx.body) : ctx.body
          if (typeof body !== 'object' || body === null) return
          const { grant_type, refresh_token } = body as Record<string, unknown>
          if (grant_type !== 'refresh_token' || typeof refresh_token !== 'string') return
          await ctx.context.adapter.delete({
            model: 'oauthAccessToken',
            where: [{ field: 'refreshToken', value: refresh_token }],
          })
        }),
      },
    ],
  },
  endpoints: {
    // Swaps an MCP access token (Authorization: Bearer) for a Convex JWT of
    // its user, like the one their browser session gets.
    mcpConvexToken: createAuthEndpoint(
      '/mcp/convex-token',
      { method: 'GET', requireHeaders: true },
      async (ctx) => {
        const accessToken = ctx.headers?.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1]
        if (!accessToken) throw new APIError('UNAUTHORIZED')
        const grant = await ctx.context.adapter.findOne<{
          id: string
          userId: string
          accessTokenExpiresAt: Date | number
        }>({
          model: 'oauthAccessToken',
          where: [{ field: 'accessToken', value: accessToken }],
        })
        const expiresAt = grant ? new Date(grant.accessTokenExpiresAt) : null
        if (!grant || !expiresAt || expiresAt.getTime() <= Date.now()) {
          throw new APIError('UNAUTHORIZED')
        }
        const user = await ctx.context.internalAdapter.findUserById(grant.userId)
        if (!user) throw new APIError('UNAUTHORIZED')
        // The Convex plugin signs a token for the session in the context, so
        // give it one standing for this grant.
        const now = new Date()
        ctx.context.session = {
          session: {
            id: `mcp_${grant.id}`,
            userId: user.id,
            token: '',
            expiresAt,
            createdAt: now,
            updatedAt: now,
          },
          user,
        }
        const { token } = await convexPlugin.endpoints.getToken({
          ...ctx,
          method: 'GET',
          asResponse: false,
          returnHeaders: false,
          returnStatus: false,
        })
        return ctx.json({ token })
      },
    ),
  },
} satisfies BetterAuthPlugin

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
      mcpPlugin,
      mcpBridge,
      convexPlugin,
    ],
  } satisfies BetterAuthOptions)

// The signed-in user, or null when signed out.
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return (await authComponent.safeGetAuthUser(ctx)) ?? null
  },
})
