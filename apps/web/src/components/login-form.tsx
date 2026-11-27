'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { REGEXP_ONLY_DIGITS } from 'input-otp'
import { ArrowLeft, ArrowRight, CircleAlert, Mail, MailCheck, RotateCw } from 'lucide-react'

import { LogoMark } from '#/components/brand'
import { useSession } from '#/components/providers'
import { Alert, AlertDescription } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import { Card } from '#/components/ui/card'
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

// A card that floats over the page: Gr8r's dialog radius, and a long soft
// shadow under it. The name step after sign-up (name-form.tsx) shares it.
export const authCardStyle =
  'rounded-2xl shadow-[0_1px_2px_rgb(28_25_20/4%),0_24px_64px_-28px_rgb(28_25_20/28%)] dark:shadow-[0_24px_64px_-28px_rgb(0_0_0/70%)]'

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
      <Card className={cn(authCardStyle, 'items-center gap-3 px-6 py-16', className)}>
        <Spinner className="size-5 text-primary" />
        <p className="text-sm text-muted-foreground">Signing you in…</p>
      </Card>
    )
  }

  return (
    <Card className={cn(authCardStyle, 'relative isolate gap-0 p-0', className)}>
      {/* A faint wash of the accent from the top edge, behind the header. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-44 bg-[radial-gradient(ellipse_75%_100%_at_50%_0%,var(--accent-soft),transparent_80%)]"
      />
      {/* Keyed by the step, so each step rises in as it replaces the last. */}
      <div key={step} className="grid animate-rise-in gap-6 px-6 pt-8 pb-6 sm:px-8 sm:pt-9 sm:pb-8">
        {step === 'email' ? (
          <>
            <header className="grid justify-items-center gap-5 text-center">
              <LogoMark className="size-11 rounded-[11px] shadow-[0_0_0_5px_var(--accent-soft),0_10px_24px_-10px_var(--accent)]" />
              <div className="grid gap-1.5">
                <h2 className="m-0 text-[1.375rem] leading-tight font-semibold tracking-[-0.025em]">
                  Welcome to Settlr
                </h2>
                <p className="text-sm text-balance text-muted-foreground">
                  Sign in or create an account. No password needed.
                </p>
              </div>
            </header>

            <div className="grid gap-5">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full"
                disabled={busy}
                onClick={() => run('google', () => signInWithGoogle(next))}
              >
                {pending === 'google' ? <Spinner /> : <GoogleLogo />}
                Continue with Google
              </Button>

              <div className="flex items-center gap-3 text-xs text-faint">
                <span className="h-px flex-1 bg-border" />
                or
                <span className="h-px flex-1 bg-border" />
              </div>

              <form noValidate onSubmit={requestCode} className="grid gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="login-email">Email</Label>
                  <div className="relative">
                    <Mail
                      aria-hidden="true"
                      className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-dim"
                    />
                    {/* The large control size (36px), to match the buttons. */}
                    <Input
                      id="login-email"
                      name="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9 sm:h-9"
                      aria-invalid={fieldError ? true : undefined}
                      aria-describedby={fieldError ? 'login-email-error' : undefined}
                    />
                  </div>
                  {fieldError && (
                    <p id="login-email-error" className="text-xs text-destructive">
                      {fieldError}
                    </p>
                  )}
                </div>
                <Button type="submit" size="lg" className="w-full" disabled={busy}>
                  {pending === 'send' && <Spinner />}
                  Email me a code
                  {pending !== 'send' && <ArrowRight />}
                </Button>
              </form>
            </div>
          </>
        ) : (
          <>
            <header className="grid justify-items-center gap-5 text-center">
              <span
                aria-hidden="true"
                className="grid size-11 animate-pop place-items-center rounded-full bg-primary-soft text-primary shadow-[0_0_0_5px_color-mix(in_srgb,var(--accent)_5%,transparent)]"
              >
                <MailCheck className="size-5" />
              </span>
              <div className="grid gap-1.5">
                <h2 className="m-0 text-[1.375rem] leading-tight font-semibold tracking-[-0.025em]">
                  Check your inbox
                </h2>
                <p className="text-sm text-muted-foreground">
                  Enter the {OTP_LENGTH}-digit code we sent to
                  <br />
                  <span className="font-medium break-words text-foreground">{email.trim()}</span>
                </p>
              </div>
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
                        className="h-12 w-full rounded-lg border text-xl font-semibold tabular-nums first:rounded-lg last:rounded-lg"
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
                {fieldError && (
                  <p className="text-center text-xs text-destructive">{fieldError}</p>
                )}
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
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
          <Alert role="alert">
            <CircleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>

      <p className="border-t bg-sunken px-6 py-3.5 text-center text-xs text-faint sm:px-8">
        {step === 'email'
          ? 'New to Settlr? Signing in creates your account.'
          : 'Expires in 5 minutes. Not there? Check your spam folder.'}
      </p>
    </Card>
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
