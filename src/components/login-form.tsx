import { useEffect, useState } from 'react'
import { Link, useRouteContext, useRouter } from '@tanstack/react-router'
import { REGEXP_ONLY_DIGITS } from 'input-otp'
import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  CircleCheck,
  Loader2,
  Mail,
  MailCheck,
  ReceiptText,
} from 'lucide-react'

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
import { Separator } from '#/components/ui/separator'
import {
  authClient,
  sendEmailOtp,
  signInWithGoogle,
  signOut,
  verifyEmailOtp,
} from '#/lib/auth-client'
import { OTP_LENGTH, emailOtpRequest, emailOtpVerify } from '#/lib/schemas'
import { cn } from '#/lib/utils'

const RESEND_COOLDOWN_S = 30

type Step = 'email' | 'code'
type Pending = 'google' | 'send' | 'verify' | null

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Try again.'
}

export function LoginForm({ className }: { className?: string }) {
  const { isAuthenticated, user } = useRouteContext({ from: '__root__' })
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
      await router.invalidate()
      await router.navigate({ to: '/groups' })
    }
  }

  function changeEmail() {
    setStep('email')
    setOtp('')
    setError(null)
    setFieldError(null)
  }

  const busy = pending !== null

  if (isAuthenticated || session) {
    return (
      <SignedInCard
        className={className}
        name={user?.name}
        email={user?.email ?? session?.user.email}
      />
    )
  }

  return (
    <Card className={cn('gap-0 overflow-hidden py-0', className)}>
      <div className="grid gap-6 px-6 pt-8 pb-6 sm:px-8">
        <header className="grid gap-4">
          <span
            aria-hidden="true"
            className="grid size-11 place-items-center rounded-xl border bg-background text-primary"
          >
            {step === 'email' ? (
              <ReceiptText className="size-5" />
            ) : (
              <MailCheck className="size-5" />
            )}
          </span>
          {step === 'email' ? (
            <div className="grid gap-1.5">
              <h2 className="m-0 text-2xl font-bold tracking-tight">
                Sign in to Settlr
              </h2>
              <p className="text-sm text-muted-foreground">
                No password needed. Use Google, or get a one-time code by email.
              </p>
            </div>
          ) : (
            <div className="grid gap-1.5">
              <h2 className="m-0 text-2xl font-bold tracking-tight">
                Check your inbox
              </h2>
              <p className="text-sm text-muted-foreground">
                We sent a {OTP_LENGTH}-digit code to{' '}
                <span className="font-medium break-all text-foreground">
                  {email.trim()}
                </span>
                . It expires in 5 minutes.
              </p>
            </div>
          )}
        </header>

        {step === 'email' ? (
          <div className="grid gap-5">
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full gap-3 bg-background text-[0.9375rem] dark:bg-background"
              disabled={busy}
              onClick={() => run('google', signInWithGoogle)}
            >
              {pending === 'google' ? (
                <Loader2 className="animate-spin" />
              ) : (
                <GoogleLogo />
              )}
              Continue with Google
            </Button>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <Separator className="flex-1" />
              or use your email
              <Separator className="flex-1" />
            </div>

            <form noValidate onSubmit={requestCode} className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="login-email">Email</Label>
                <div className="relative">
                  <Mail
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="login-email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 bg-background pl-10 text-[0.9375rem] dark:bg-background"
                    aria-invalid={fieldError ? true : undefined}
                    aria-describedby={fieldError ? 'login-email-error' : undefined}
                  />
                </div>
                {fieldError && (
                  <p id="login-email-error" className="text-sm text-destructive">
                    {fieldError}
                  </p>
                )}
              </div>
              <Button
                type="submit"
                className="h-11 w-full text-[0.9375rem]"
                disabled={busy}
              >
                {pending === 'send' && <Loader2 className="animate-spin" />}
                Email me a code
              </Button>
            </form>
          </div>
        ) : (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              void verifyCode(otp)
            }}
            className="grid gap-5"
          >
            <div className="grid justify-items-center gap-2">
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
              >
                <InputOTPGroup className="gap-2">
                  {Array.from({ length: OTP_LENGTH }, (_, i) => (
                    <InputOTPSlot
                      key={i}
                      index={i}
                      aria-invalid={fieldError ? true : undefined}
                      className="size-12 rounded-lg border bg-background text-lg font-semibold first:rounded-lg last:rounded-lg dark:bg-background"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              {fieldError && (
                <p className="text-sm text-destructive">{fieldError}</p>
              )}
            </div>

            <Button
              type="submit"
              className="h-11 w-full text-[0.9375rem]"
              disabled={busy || otp.length < OTP_LENGTH}
            >
              {pending === 'verify' && <Loader2 className="animate-spin" />}
              Verify and sign in
            </Button>

            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-2 text-muted-foreground"
                onClick={changeEmail}
              >
                <ArrowLeft />
                Different email
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-mr-2 text-muted-foreground"
                disabled={busy || resendIn > 0}
                onClick={() => void requestCode()}
              >
                {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
              </Button>
            </div>
          </form>
        )}

        {error && (
          <Alert role="alert">
            <CircleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>

      <div className="border-t px-6 py-4 text-center text-sm text-muted-foreground sm:px-8">
        Just looking?{' '}
        <Link
          to="/groups"
          className="group inline-flex items-center gap-1 font-medium text-primary no-underline underline-offset-4 hover:underline"
        >
          Continue as guest
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </Card>
  )
}

function SignedInCard({
  className,
  name,
  email,
}: {
  className?: string
  name?: string
  email?: string
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function onSignOut() {
    setPending(true)
    try {
      await signOut()
      await router.invalidate()
    } finally {
      setPending(false)
    }
  }

  return (
    <Card className={cn('gap-6 px-6 py-8 sm:px-8', className)}>
      <header className="grid gap-4">
        <span
          aria-hidden="true"
          className="grid size-11 place-items-center rounded-xl border bg-background text-primary"
        >
          <CircleCheck className="size-5" />
        </span>
        <div className="grid gap-1.5">
          <h2 className="m-0 text-2xl font-bold tracking-tight">
            {name ? `Hi, ${name}` : 'You’re signed in'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {email ? (
              <>
                Signed in as{' '}
                <span className="font-medium break-all text-foreground">
                  {email}
                </span>
                .
              </>
            ) : (
              'Welcome back.'
            )}
          </p>
        </div>
      </header>
      <div className="grid gap-3">
        <Button asChild className="h-11 w-full text-[0.9375rem]">
          <Link to="/groups">
            Go to your groups
            <ArrowRight />
          </Link>
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-10 w-full text-muted-foreground"
          disabled={pending}
          onClick={onSignOut}
        >
          {pending && <Loader2 className="animate-spin" />}
          Sign out
        </Button>
      </div>
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
