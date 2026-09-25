import { useState } from 'react'
import { useRouteContext, useRouter } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { signOut } from '#/lib/auth-client'

// Signed-in user and sign-out, in the header. Renders nothing when signed
// out; the sign-in form lives on the home page. The user comes from route
// context, so the server and first client render agree.
export function AccountMenu() {
  const { user } = useRouteContext({ from: '__root__' })
  const router = useRouter()
  const [pending, setPending] = useState(false)

  if (!user) return null

  const label = user.name || user.email

  async function onSignOut() {
    setPending(true)
    try {
      await signOut()
      await router.invalidate()
      await router.navigate({ to: '/' })
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="ml-1 flex items-center gap-2 border-l pl-3">
      <span
        aria-hidden="true"
        className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary uppercase"
      >
        {label.charAt(0)}
      </span>
      <span
        className="hidden max-w-44 truncate text-sm text-muted-foreground md:inline"
        title={user.name ? user.email : undefined}
      >
        {label}
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={onSignOut}
        disabled={pending}
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut />
      </Button>
    </div>
  )
}
