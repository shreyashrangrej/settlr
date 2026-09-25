import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Eye, EyeOff, Info, Lock, Mail } from 'lucide-react'

import { Alert, AlertDescription } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Checkbox } from '#/components/ui/checkbox'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Separator } from '#/components/ui/separator'
import { loginInput } from '#/lib/schemas'
import { cn } from '#/lib/utils'

type FieldErrors = Partial<Record<'email' | 'password', string>>

export function LoginForm({ className }: { className?: string }) {
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitted, setSubmitted] = useState(false)

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const result = loginInput.safeParse({
      email: form.get('email'),
      password: form.get('password'),
      remember: form.get('remember') === 'on',
    })

    if (!result.success) {
      const fieldErrors: FieldErrors = {}
      for (const issue of result.error.issues) {
        const field = issue.path[0]
        if ((field === 'email' || field === 'password') && !fieldErrors[field]) {
          fieldErrors[field] = issue.message
        }
      }
      setErrors(fieldErrors)
      setSubmitted(false)
      return
    }

    // There is no account system yet (the data store is anonymous and in
    // memory), so a valid submission can't sign anyone in. Say so plainly.
    setErrors({})
    setSubmitted(true)
  }

  return (
    <Card className={cn('gap-5', className)}>
      <CardHeader>
        <CardTitle className="text-2xl font-bold tracking-tight">
          Welcome back
        </CardTitle>
        <CardDescription>
          Sign in to pick up where your groups left off.
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-5">
        <form noValidate onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="login-email">Email</Label>
            <div className="relative">
              <Mail
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className="h-10 pl-9"
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={errors.email ? 'login-email-error' : undefined}
              />
            </div>
            {errors.email && (
              <p id="login-email-error" className="text-sm text-destructive">
                {errors.email}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="login-password">Password</Label>
            <div className="relative">
              <Lock
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                className="h-10 pr-10 pl-9"
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={
                  errors.password ? 'login-password-error' : undefined
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-1/2 right-1 size-8 -translate-y-1/2 text-muted-foreground"
                onClick={() => setShowPassword((shown) => !shown)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </Button>
            </div>
            {errors.password && (
              <p id="login-password-error" className="text-sm text-destructive">
                {errors.password}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="login-remember" name="remember" />
            <Label htmlFor="login-remember" className="font-normal">
              Keep me signed in
            </Label>
          </div>

          <Button type="submit" size="lg" className="h-10 w-full">
            Sign in
          </Button>

          {submitted && (
            <Alert role="status">
              <Info />
              <AlertDescription>
                Accounts aren’t available yet. Continue as a guest to use
                Settlr now.
              </AlertDescription>
            </Alert>
          )}
        </form>

        <div className="flex items-center gap-3 text-xs text-muted-foreground uppercase">
          <Separator className="flex-1" />
          or
          <Separator className="flex-1" />
        </div>

        <Button asChild variant="outline" size="lg" className="h-10 w-full">
          <Link to="/groups">
            Continue as guest
            <ArrowRight />
          </Link>
        </Button>
      </CardContent>

      <CardFooter className="justify-center text-sm text-muted-foreground">
        <p>
          New here?{' '}
          <Link
            to="/groups/new"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Start a group
          </Link>
          , no account needed.
        </p>
      </CardFooter>
    </Card>
  )
}
