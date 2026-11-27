'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CircleAlert, UserRound } from 'lucide-react'

import { Alert, AlertDescription } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import { Card } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Field, FieldError, FieldLabel } from '#/components/ui/field'
import { Spinner } from '#/components/ui/spinner'
import { authCardStyle } from '#/components/login-form'
import { updateName } from '#/lib/auth-client'
import { NAME_MAX_LENGTH, profileName } from '@settlr/shared/schemas'
import { cn } from '#/lib/utils'

// Shown in place of every page until a new email-code account gives its
// name. Google accounts already have one.
export function NameForm({ email }: { email: string }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [pending, setPending] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const parsed = profileName.safeParse({ name })
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Enter your full name')
      return
    }
    setFieldError(null)
    setError(null)
    setPending(true)
    try {
      await updateName(parsed.data.name)
      // Reloads the session, so the page this replaced renders.
      router.refresh()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Something went wrong. Try again.',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="grid place-items-center py-12">
      <Card className={cn(authCardStyle, 'w-full max-w-md animate-rise-in gap-6 px-6 pt-8 pb-6 sm:px-8 sm:pt-9 sm:pb-8')}>
        <header className="grid justify-items-center gap-5 text-center">
          <span
            aria-hidden="true"
            className="grid size-11 animate-pop place-items-center rounded-full bg-primary-soft text-primary shadow-[0_0_0_5px_color-mix(in_srgb,var(--accent)_5%,transparent)]"
          >
            <UserRound className="size-5" />
          </span>
          <div className="grid gap-1.5">
            <h1 className="m-0 text-[1.375rem] leading-tight font-semibold tracking-[-0.025em]">
              What’s your name?
            </h1>
            <p className="text-sm text-muted-foreground">
              Your groups will see this on expenses and balances.
              {email && (
                <>
                  {' '}
                  You’re signed in as{' '}
                  <span className="font-medium break-words text-foreground">
                    {email}
                  </span>
                  .
                </>
              )}
            </p>
          </div>
        </header>

        <form noValidate onSubmit={onSubmit} className="grid gap-3">
          <Field>
            <FieldLabel htmlFor="profile-name">Full name</FieldLabel>
            <Input
              id="profile-name"
              name="name"
              autoComplete="name"
              autoFocus
              placeholder="Alex Morgan"
              maxLength={NAME_MAX_LENGTH}
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? 'profile-name-error' : undefined}
              className="sm:h-9"
            />
            {fieldError && (
              <FieldError id="profile-name-error">{fieldError}</FieldError>
            )}
          </Field>
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending && <Spinner />}
            Continue
          </Button>
        </form>

        {error && (
          <Alert role="alert">
            <CircleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </Card>
    </div>
  )
}
