'use client'

import { useState } from 'react'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'

import { ConfirmAction } from '#/components/confirm-action'
import { CurrencySelect } from '#/components/form-fields'
import { useAction } from '#/components/ledger'
import { PageHeader } from '#/components/page-header'
import { useSession } from '#/components/providers'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Field, FieldDescription, FieldLabel } from '#/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '#/components/ui/input-group'
import { readPreferences, writePreferences } from '#/lib/preferences'
import type { Currency } from '@settlr/shared/schemas'
import { api } from '@settlr/backend/convex/_generated/api'

/**
 * Preferences live in this browser's localStorage, so this only renders in
 * the browser (the page wraps it in <ClientOnly>).
 */
export function SettingsView() {
  const [currency, setCurrency] = useState<Currency>(
    () => readPreferences().defaultCurrency,
  )

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        back={{ fallback: '/', label: 'Back' }}
        title="Settings"
        description="Stored in this browser only."
      />
      <Card>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            writePreferences({ defaultCurrency: currency })
            toast.success('Settings saved')
          }}
        >
          <CardHeader>
            <CardTitle>Defaults</CardTitle>
            <CardDescription>Used to pre-fill new groups and expenses.</CardDescription>
          </CardHeader>
          <CardContent className="mt-4">
            <Field>
              <FieldLabel htmlFor="default-currency">Default currency</FieldLabel>
              <CurrencySelect
                id="default-currency"
                value={currency}
                onChange={setCurrency}
                className="sm:w-48"
              />
              <FieldDescription>
                You can still pick another currency on any expense.
              </FieldDescription>
            </Field>
          </CardContent>
          <CardFooter className="mt-6 justify-end">
            <Button type="submit" size="lg">
              Save
            </Button>
          </CardFooter>
        </form>
      </Card>
      <AiAssistantsCard />
    </div>
  )
}

/**
 * The MCP server's URL, to add Settlr to Claude, ChatGPT or another agent,
 * and the apps connected so far (signed in only).
 */
function AiAssistantsCard() {
  const signedIn = useSession().user !== null
  const url = `${window.location.origin}/api/mcp`

  return (
    <Card className="mt-[18px]">
      <CardHeader>
        <CardTitle>AI assistants</CardTitle>
        <CardDescription>
          Use Settlr from Claude, ChatGPT or another agent that supports MCP: it can add, find,
          change and delete your expenses.
        </CardDescription>
      </CardHeader>
      <CardContent className="mt-4 grid gap-6">
        <Field>
          <FieldLabel htmlFor="mcp-url">Connector URL</FieldLabel>
          <InputGroup>
            <InputGroupInput id="mcp-url" readOnly value={url} className="font-mono" />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                aria-label="Copy URL"
                size="icon-xs"
                onClick={() =>
                  navigator.clipboard.writeText(url).then(
                    () => toast.success('Copied'),
                    () => toast.error('Couldn’t copy. Select the URL and copy it instead.'),
                  )
                }
              >
                <Copy />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <FieldDescription>
            In Claude, add it under Settings → Connectors → Add custom connector. In ChatGPT,
            turn on developer mode under Settings → Apps → Advanced settings, then create an app
            with it. You’ll sign in to Settlr and approve the connection.
          </FieldDescription>
        </Field>
        {signedIn && <Connections />}
      </CardContent>
    </Card>
  )
}

function Connections() {
  const { data: apps } = useQuery(convexQuery(api.mcp.connections, {}))
  const { run } = useAction(useConvexMutation(api.mcp.disconnect), {
    success: 'Disconnected',
    toastErrors: true,
  })

  if (!apps?.length) return null
  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">Connected</p>
      <ul className="grid gap-2">
        {apps.map((app) => (
          <li
            key={app.clientId}
            className="flex items-center justify-between gap-3 rounded-2xl bg-tile px-4 py-2.5"
          >
            <span className="min-w-0 truncate text-sm font-medium">{app.name}</span>
            <ConfirmAction
              title={`Disconnect ${app.name}?`}
              description="It loses access to your Settlr account until you connect it again."
              confirmLabel="Disconnect"
              onConfirm={async () => Boolean(await run({ clientId: app.clientId }))}
              trigger={
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  Disconnect
                </Button>
              }
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
