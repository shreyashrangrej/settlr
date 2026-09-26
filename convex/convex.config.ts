import betterAuth from '@convex-dev/better-auth/convex.config'
import { defineApp } from 'convex/server'
import { v } from 'convex/values'

// Deployment env vars, set with `pnpm exec convex env set NAME=value`.
// Required ones fail the deploy when missing instead of breaking sign-in at
// runtime. Read them via `env` from `./_generated/server`.
const app = defineApp({
  env: {
    // Public origin of the web app, e.g. http://localhost:3000.
    SITE_URL: v.string(),
    // Signs Better Auth sessions and tokens (`openssl rand -base64 32`).
    BETTER_AUTH_SECRET: v.string(),
    // Google sign-in is enabled only when both are set.
    GOOGLE_CLIENT_ID: v.optional(v.string()),
    GOOGLE_CLIENT_SECRET: v.optional(v.string()),
    // Without a Resend key, sign-in codes are written to the Convex logs
    // instead of being emailed (fine for local development only).
    RESEND_API_KEY: v.optional(v.string()),
    AUTH_EMAIL_FROM: v.optional(v.string()),
    // The assistant (/assistant) sends chat messages to this OpenRouter
    // model, which must support tool calling. It's off until both are set.
    OPENROUTER_API_KEY: v.optional(v.string()),
    OPENROUTER_MODEL: v.optional(v.string()),
  },
})

app.use(betterAuth)

export default app
