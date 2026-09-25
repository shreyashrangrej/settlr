import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { CircleAlert, UserRound } from 'lucide-react'

import { Alert, AlertDescription } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import { Card } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Field, FieldError, FieldLabel } from '#/components/ui/field'
import { Spinner } from '#/components/ui/spinner'
import { updateName } from '#/lib/auth-client'
import { NAME_MAX_LENGTH, profileName } from '#/lib/schemas'

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
      await router.invalidate()
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
      <Card className="w-full max-w-md gap-6 px-6 py-8 sm:px-8">
        <header className="grid gap-4">
          <span
            aria-hidden="true"
            className="grid size-11 place-items-center rounded-xl border bg-background text-primary"
          >
            <UserRound className="size-5" />
          </span>
          <div className="grid gap-1.5">
            <h1 className="m-0 text-2xl font-bold tracking-tight">
              What’s your name?
            </h1>
            <p className="text-sm text-muted-foreground">
              Your groups will see this on expenses and balances.
              {email && (
                <>
                  {' '}
                  You’re signed in as{' '}
                  <span className="font-medium break-all text-foreground">
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
              className="h-11 bg-background text-[0.9375rem] dark:bg-background"
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? 'profile-name-error' : undefined}
            />
            {fieldError && (
              <FieldError id="profile-name-error">{fieldError}</FieldError>
            )}
          </Field>
          <Button
            type="submit"
            className="h-11 w-full text-[0.9375rem]"
            disabled={pending}
          >
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
