'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { REGEXP_ONLY_DIGITS } from 'input-otp'
import { ArrowLeft, ArrowRight, CircleAlert, RotateCw } from 'lucide-react'

import { useSession } from '#/components/providers'
import { Alert, AlertDescription } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '#/components/ui/input-otp'
import { Label } from '#/components/ui/label'
import { Spinner } from '#/components/ui/spinner'
import {
  authClient,
  sendEmailOtp,
  signInWithGoogle,
  verifyEmailOtp,
} from '#/lib/auth-client'
import { OTP_LENGTH, emailOtpRequest, emailOtpVerify } from '@settlr/shared/schemas'
import { cn } from '#/lib/utils'

const RESEND_COOLDOWN_S = 30

// The sign-in card has no edges: a soft tray (no border, wide corners)
// holds the form on a raised panel, with a one-line note on the tray below
// it. Its fields are filled rather than outlined: the border only shows on
// focus (or an error). The name step after sign-up (name-form.tsx) shares
// all of it.
export function AuthCard({
  children,
  note,
  className,
}: {
  children: React.ReactNode
  /** A line on the tray under the panel. */
  note?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('rounded-[1.75rem] bg-muted p-1.5 dark:bg-sunken', className)}>
      <div className="rounded-[1.375rem] bg-card px-6 py-7 shadow-[0_1px_2px_rgb(28_25_20/6%),0_12px_32px_-16px_rgb(28_25_20/22%)] sm:px-8 sm:py-8 dark:bg-muted dark:shadow-[inset_0_1px_0_rgb(255_255_255/5%),0_12px_32px_-16px_rgb(0_0_0/60%)]">
        {children}
      </div>
      {note && <p className="px-6 pt-3 pb-2 text-center text-xs text-pretty text-muted-foreground">{note}</p>}
    </div>
  )
}

export const authHeadingStyle = 'm-0 text-[1.375rem] leading-tight font-semibold tracking-[-0.025em]'
export const authInputStyle =
  'h-10 border-transparent bg-muted text-base hover:border-transparent hover:bg-raised focus-visible:border-ring focus-visible:bg-field sm:h-10 sm:text-sm dark:bg-raised dark:hover:bg-[color-mix(in_oklab,var(--surface-3),var(--text)_5%)]'
// The large buttons, at the fields' height.
const authButtonStyle = 'h-10 w-full sm:h-10'

type Step = 'email' | 'code'
type Pending = 'google' | 'send' | 'verify' | null

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Try again.'
}

/**
 * Sign-in with Google or an email code. Afterwards it goes to the
 * dashboard, or to `next` (a same-site path) with a full page load, for
 * flows that continue outside the app router (connecting an MCP client).
 */
export function LoginForm({ className, next }: { className?: string; next?: string }) {
  const isAuthenticated = useSession().user !== null
  const { data: session } = authClient.useSession()
  const router = useRouter()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [pending, setPending] = useState<Pending>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resendIn, setResendIn] = useState(0)

  useEffect(() => {
    if (resendIn <= 0) return
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendIn])

  async function run(kind: Exclude<Pending, null>, action: () => Promise<void>) {
    setPending(kind)
    setError(null)
    try {
      await action()
      return true
    } catch (err) {
      setError(errorMessage(err))
      return false
    } finally {
      setPending(null)
    }
  }

  async function requestCode(event?: React.FormEvent) {
    event?.preventDefault()
    const parsed = emailOtpRequest.safeParse({ email: email.trim() })
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Enter a valid email')
      return
    }
    setFieldError(null)
    const sent = await run('send', () => sendEmailOtp(parsed.data.email))
    if (sent) {
      setOtp('')
      setStep('code')
      setResendIn(RESEND_COOLDOWN_S)
    }
  }

  async function verifyCode(code: string) {
    const parsed = emailOtpVerify.safeParse({ email: email.trim(), otp: code })
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Enter the code')
      return
    }
    setFieldError(null)
    const signedIn = await run('verify', () =>
      verifyEmailOtp(parsed.data.email, parsed.data.otp),
    )
    if (signedIn) {
      if (next) {
        window.location.assign(next)
        return
      }
      // Render the server components again as the signed-in user.
      router.push('/dashboard')
      router.refresh()
    }
  }

  function changeEmail() {
    setStep('email')
    setOtp('')
    setError(null)
    setFieldError(null)
  }

  const busy = pending !== null

  // Signed in: the home route is redirecting to the dashboard.
  if (isAuthenticated || session) {
    return (
      <AuthCard className={className}>
        <p className="flex items-center justify-center gap-2.5 py-14 text-sm text-muted-foreground">
          <Spinner className="size-4 text-primary" />
          Signing you in…
        </p>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      className={className}
      note={
        step === 'email'
          ? 'New to Settlr? Signing in creates your account.'
          : 'Expires in 5 minutes. Not there? Check your spam folder.'
      }
    >
      {/* Keyed by the step, so each step rises in as it replaces the last. */}
      <div key={step} className="grid animate-rise-in gap-7">
        {step === 'email' ? (
          <>
            <header className="grid gap-1.5">
              <h2 className={authHeadingStyle}>Sign in to Settlr</h2>
              <p className="text-sm text-pretty text-muted-foreground">
                No password needed: continue with Google, or we’ll email you a code.
              </p>
            </header>

            <div className="grid gap-5">
              <Button
                type="button"
                variant="secondary"
                className={cn(
                  authButtonStyle,
                  'dark:bg-raised dark:hover:bg-[color-mix(in_oklab,var(--surface-3),var(--text)_5%)]',
                )}
                disabled={busy}
                onClick={() => run('google', () => signInWithGoogle(next))}
              >
                {pending === 'google' ? <Spinner /> : <GoogleLogo />}
                Continue with Google
              </Button>

              <div className="flex items-center gap-3 text-xs text-faint">
                <span className="h-px flex-1 bg-divider dark:bg-raised" />
                or
                <span className="h-px flex-1 bg-divider dark:bg-raised" />
              </div>

              <form noValidate onSubmit={requestCode} className="grid gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={authInputStyle}
                    aria-invalid={fieldError ? true : undefined}
                    aria-describedby={fieldError ? 'login-email-error' : undefined}
                  />
                  {fieldError && (
                    <p id="login-email-error" className="text-xs text-destructive">
                      {fieldError}
                    </p>
                  )}
                </div>
                <Button type="submit" className={authButtonStyle} disabled={busy}>
                  {pending === 'send' && <Spinner />}
                  Email me a code
                  {pending !== 'send' && <ArrowRight />}
                </Button>
              </form>
            </div>
          </>
        ) : (
          <>
            <header className="grid gap-1.5">
              <h2 className={authHeadingStyle}>Check your inbox</h2>
              <p className="text-sm text-pretty text-muted-foreground">
                Enter the {OTP_LENGTH}-digit code we sent to{' '}
                <span className="font-medium break-words text-foreground">{email.trim()}</span>.
              </p>
            </header>

            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault()
                void verifyCode(otp)
              }}
              className="grid gap-4"
            >
              <div className="grid gap-2">
                <InputOTP
                  maxLength={OTP_LENGTH}
                  pattern={REGEXP_ONLY_DIGITS}
                  value={otp}
                  onChange={setOtp}
                  onComplete={(code: string) => void verifyCode(code)}
                  autoFocus
                  autoComplete="one-time-code"
                  aria-label="One-time code"
                  disabled={pending === 'verify'}
                  aria-invalid={fieldError ? true : undefined}
                  containerClassName="w-full"
                >
                  <InputOTPGroup className="grid w-full grid-cols-6 gap-2">
                    {Array.from({ length: OTP_LENGTH }, (_, i) => (
                      <InputOTPSlot
                        key={i}
                        index={i}
                        aria-invalid={fieldError ? true : undefined}
                        className="h-12 w-full rounded-lg border border-transparent bg-muted text-xl font-semibold tabular-nums first:rounded-lg first:border-l last:rounded-lg data-[active=true]:bg-field dark:bg-raised dark:data-[active=true]:bg-field"
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
                {fieldError && <p className="text-xs text-destructive">{fieldError}</p>}
              </div>

              <Button
                type="submit"
                className={authButtonStyle}
                disabled={busy || otp.length < OTP_LENGTH}
              >
                {pending === 'verify' && <Spinner />}
                Verify and sign in
              </Button>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button type="button" variant="ghost" size="sm" className="-ml-2" onClick={changeEmail}>
                  <ArrowLeft />
                  Different email
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-mr-2"
                  disabled={busy || resendIn > 0}
                  onClick={() => void requestCode()}
                >
                  <RotateCw />
                  {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
                </Button>
              </div>
            </form>
          </>
        )}

        {error && (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    </AuthCard>
  )
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[18px]">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.26-2.09 3.55-5.17 3.55-8.87Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3A7.2 7.2 0 0 1 12 19.25a7.14 7.14 0 0 1-6.72-4.93h-4v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.32A7.2 7.2 0 0 1 4.9 12c0-.81.14-1.59.38-2.32V6.59h-4A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.41l4-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.28 6.59l4 3.09A7.14 7.14 0 0 1 12 4.75Z"
      />
    </svg>
  )
}
