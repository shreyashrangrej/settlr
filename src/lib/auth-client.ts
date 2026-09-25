// Sign-in actions used by the login form.
//
// Placeholders until Better Auth (emailOTP plugin + Google provider) runs on
// Convex. Each one then becomes a single `authClient` call:
//   sendEmailOtp     -> authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' })
//   verifyEmailOtp   -> authClient.signIn.emailOtp({ email, otp })
//   signInWithGoogle -> authClient.signIn.social({ provider: 'google' })

export class AuthUnavailableError extends Error {
  constructor() {
    super('Sign-in isn’t connected yet. Continue as a guest for now.')
    this.name = 'AuthUnavailableError'
  }
}

export async function sendEmailOtp(_email: string): Promise<void> {
  throw new AuthUnavailableError()
}

export async function verifyEmailOtp(_email: string, _otp: string): Promise<void> {
  throw new AuthUnavailableError()
}

export async function signInWithGoogle(): Promise<void> {
  throw new AuthUnavailableError()
}
