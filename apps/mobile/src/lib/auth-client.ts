import { expoClient } from '@better-auth/expo/client'
import { convexClient } from '@convex-dev/better-auth/client/plugins'
import { emailOTPClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import * as SecureStore from 'expo-secure-store'

// Better Auth for the app. Requests go to the web app's origin (its
// /api/auth/* route forwards them to Convex), because Google sends people
// back there and the OAuth state cookie has to be on the same host. Without
// EXPO_PUBLIC_SITE_URL it talks to the .convex.site URL directly, where
// email codes work but Google doesn't.
const baseURL = process.env.EXPO_PUBLIC_SITE_URL || process.env.EXPO_PUBLIC_CONVEX_SITE_URL
if (!baseURL) {
  throw new Error(
    'EXPO_PUBLIC_CONVEX_SITE_URL is not set. Create apps/mobile/.env.local (see the mobile app docs).',
  )
}

// The session cookie lives in the phone's secure storage (keys `settlr_*`),
// so people stay signed in across restarts.
export const authClient = createAuthClient({
  baseURL,
  plugins: [
    expoClient({ scheme: 'settlr', storagePrefix: 'settlr', storage: SecureStore }),
    emailOTPClient(),
    convexClient(),
  ],
})

// Better Auth error codes shown to people in plain words (as on the web).
const MESSAGES: Record<string, string> = {
  INVALID_OTP: 'That code isn’t right. Check it and try again.',
  OTP_EXPIRED: 'That code has expired. Send a new one.',
  TOO_MANY_ATTEMPTS: 'Too many attempts. Send a new code.',
  PROVIDER_NOT_FOUND: 'Google sign-in isn’t set up yet. Use your email instead.',
}

type AuthError = { code?: string; message?: string; status?: number } | null

function throwIfError(error: AuthError) {
  if (!error) return
  const known = error.code ? MESSAGES[error.code] : undefined
  if (known) throw new Error(known)
  if (error.status === 429) throw new Error('Too many requests. Wait a moment and try again.')
  throw new Error(error.message || 'Something went wrong. Try again.')
}

export function errorMessage(error: unknown) {
  if (error instanceof TypeError) return 'Can’t reach Settlr. Check your connection and try again.'
  return error instanceof Error ? error.message : 'Something went wrong. Try again.'
}

export async function sendEmailOtp(email: string) {
  const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' })
  throwIfError(error)
}

export async function verifyEmailOtp(email: string, otp: string) {
  const { error } = await authClient.signIn.emailOtp({ email, otp })
  throwIfError(error)
}

/**
 * Opens Google in an in-app browser; it comes back to the app through the
 * settlr:// (or Expo Go's exp://) deep link with the session.
 */
export async function signInWithGoogle() {
  const { error } = await authClient.signIn.social({ provider: 'google', callbackURL: '/' })
  throwIfError(error)
}

export async function signOut() {
  const { error } = await authClient.signOut()
  throwIfError(error)
}

/** Renames the signed-in user (Convex picks the new name up on its next token). */
export async function updateName(name: string) {
  const { error } = await authClient.updateUser({ name })
  throwIfError(error)
}

/** The web app's origin: MCP connector URL, docs links. */
export const SITE_URL = baseURL
