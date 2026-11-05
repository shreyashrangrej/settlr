'use client'

import { convexQuery } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { CircleAlert, Link2Off, PlugZap } from 'lucide-react'

import { useAction } from '#/components/ledger'
import { useSession } from '#/components/providers'
import { Alert, AlertDescription } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import { Card } from '#/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '#/components/ui/empty'
import { Spinner } from '#/components/ui/spinner'
import { authClient } from '#/lib/auth-client'
import { api } from '#convex/_generated/api'

/**
 * Asks the signed-in user to approve an MCP client. Either answer goes back
 * to the client: with a code it trades for a token, or with access_denied.
 */
export function ConnectView({ clientId, consentCode }: { clientId: string; consentCode: string }) {
  const { user } = useSession()
  const { data: app } = useSuspenseQuery(convexQuery(api.mcp.client, { clientId }))
  const name = app?.name ?? 'An unnamed app'

  const { run, pending, error } = useAction(async (accept: boolean) => {
    const { data, error } = await authClient.$fetch<{ redirectURI: string }>('/oauth2/consent', {
      method: 'POST',
      body: { accept, consent_code: consentCode },
    })
    if (error || !data?.redirectURI) {
      throw new Error(
        error?.status === 401
          ? 'This request has expired. Start connecting again from the app.'
          : 'That didn’t work. Try again.',
      )
    }
    // Keep the buttons busy until the browser leaves.
    window.location.assign(data.redirectURI)
    await new Promise(() => {})
  })

  if (!app) return <UnknownApp />

  return (
    <div className="mx-auto max-w-md py-6">
      <Card className="gap-6 px-6 py-8 sm:px-8">
        <header className="grid gap-4">
          <span
            aria-hidden="true"
            className="grid size-11 place-items-center rounded-xl border border-highlight-border bg-highlight text-primary"
          >
            <PlugZap className="size-5" />
          </span>
          <div className="grid gap-1.5">
            <h1 className="m-0 text-2xl font-semibold tracking-[-0.03em] break-words">
              Connect {name} to Settlr?
            </h1>
            <p className="text-sm text-muted-foreground">
              Signed in as{' '}
              <span className="font-medium break-all text-foreground">
                {user?.name || user?.email}
              </span>
              {user?.name && user.email ? ` (${user.email})` : ''}
            </p>
          </div>
        </header>

        <div className="grid gap-2 rounded-2xl bg-tile px-4 py-3.5 text-sm">
          <p className="font-medium">It will be able to:</p>
          <ul className="grid list-disc gap-1 pl-5 text-soft">
            <li>See your friends, groups and expenses</li>
            <li>Add, change and delete expenses for you</li>
          </ul>
        </div>

        <p className="text-sm text-muted-foreground">
          Only allow this if you started connecting from {name} just now.
          {app.redirectHosts.length > 0 && (
            <>
              {' '}You’ll go back to{' '}
              <span className="font-medium break-all text-foreground">
                {app.redirectHosts.join(', ')}
              </span>
              .
            </>
          )}{' '}
          You can disconnect it any time in Settings.
        </p>

        {error && (
          <Alert role="alert">
            <CircleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={pending}
            onClick={() => void run(false)}
          >
            Cancel
          </Button>
          <Button type="button" size="lg" disabled={pending} onClick={() => void run(true)}>
            {pending && <Spinner />}
            Allow
          </Button>
        </div>
      </Card>
    </div>
  )
}

export function UnknownApp() {
  return (
    <Empty className="py-20">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Link2Off />
        </EmptyMedia>
        <EmptyTitle>Unknown app</EmptyTitle>
        <EmptyDescription>
          This app isn’t registered with Settlr. Start connecting again from the app.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
