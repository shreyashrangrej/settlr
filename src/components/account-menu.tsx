import { useState } from 'react'
import { useRouteContext, useRouter } from '@tanstack/react-router'
import { LogOut, UserRound } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { authClient, signOut } from '#/lib/auth-client'

// Signed-in user and sign-out, in the header. Renders nothing when signed
// out; the sign-in form lives on the home page.
export function AccountMenu() {
  // SSR knows whether there is a session; the details (email) load on the
  // client, so the server and first client render agree.
  const { isAuthenticated } = useRouteContext({ from: '__root__' })
  const { data: session } = authClient.useSession()
  const router = useRouter()
  const [pending, setPending] = useState(false)

  if (!session && !isAuthenticated) return null

  const email = session?.user.email

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
        {email ? email.charAt(0) : <UserRound className="size-4" />}
      </span>
      <span className="hidden max-w-44 truncate text-sm text-muted-foreground md:inline">
        {email}
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
