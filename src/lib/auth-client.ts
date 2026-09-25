import { convexClient } from '@convex-dev/better-auth/client/plugins'
import { emailOTPClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

// Browser half of Better Auth. Requests go to this app's /api/auth/* route,
// which forwards them to Convex.
export const authClient = createAuthClient({
  plugins: [emailOTPClient(), convexClient()],
})

// Better Auth error codes shown to people in plain words.
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
  if (error.status === 429) {
    throw new Error('Too many requests. Wait a moment and try again.')
  }
  throw new Error(error.message || 'Something went wrong. Try again.')
}

export async function sendEmailOtp(email: string) {
  const { error } = await authClient.emailOtp.sendVerificationOtp({
    email,
    type: 'sign-in',
  })
  throwIfError(error)
}

export async function verifyEmailOtp(email: string, otp: string) {
  const { error } = await authClient.signIn.emailOtp({ email, otp })
  throwIfError(error)
}

// Redirects the browser to Google; it comes back to `callbackURL`.
export async function signInWithGoogle(callbackURL = '/groups') {
  const { error } = await authClient.signIn.social({
    provider: 'google',
    callbackURL,
  })
  throwIfError(error)
}

export async function signOut() {
  const { error } = await authClient.signOut()
  throwIfError(error)
}
