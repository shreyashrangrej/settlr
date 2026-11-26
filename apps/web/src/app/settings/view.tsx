'use client'

import { useState } from 'react'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { Check, Copy, Monitor, Moon, Sun } from 'lucide-react'
import { toast } from 'sonner'
import type { FunctionReturnType } from 'convex/server'

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
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from '#/components/ui/field'
import { Checkbox } from '#/components/ui/checkbox'
import { Input } from '#/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '#/components/ui/input-group'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { readPreferences, writePreferences } from '#/lib/preferences'
import {
  ACCENTS,
  applyAccent,
  applyFrame,
  applyMotion,
  applyTheme,
  originOf,
  readAccent,
  readFrame,
  readMotion,
  readThemeChoice,
  type Accent,
  type Frame,
  type Motion,
  type ThemeChoice,
} from '#/lib/theme'
import { cn } from '#/lib/utils'
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
        description="Defaults are kept in this browser; account settings follow you on every device."
      />
      <AppearanceCard />
      <Card className="mt-[18px]">
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
      <AccountCard />
      <AiAssistantsCard />
    </div>
  )
}

const THEMES = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
] as const

/**
 * Gr8r's appearance settings: theme, accent colour, the app frame and
 * motion. Each applies as soon as it's picked (no Save), and is remembered
 * in this browser.
 */
function AppearanceCard() {
  const [theme, setTheme] = useState<ThemeChoice>(readThemeChoice)
  const [accent, setAccent] = useState<Accent>(readAccent)
  const [frame, setFrame] = useState<Frame>(readFrame)
  const [motion, setMotion] = useState<Motion>(readMotion)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>Applies right away, in this browser.</CardDescription>
      </CardHeader>
      <CardContent className="mt-4 grid gap-5">
        <Field orientation="horizontal" className="flex-wrap justify-between gap-y-2">
          <FieldContent className="min-w-56">
            <FieldTitle>Theme</FieldTitle>
            <FieldDescription>System follows your device’s light or dark setting.</FieldDescription>
          </FieldContent>
          <Tabs
            value={theme}
            onValueChange={(value: ThemeChoice, details) => {
              setTheme(value)
              applyTheme(value, originOf(details.event))
            }}
          >
            <TabsList aria-label="Theme">
              {THEMES.map(({ value, label, icon: Icon }) => (
                <TabsTrigger key={value} value={value}>
                  <Icon />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </Field>

        <Field orientation="horizontal" className="flex-wrap justify-between gap-y-2">
          <FieldContent className="min-w-56">
            <FieldTitle id="accent-label">Accent colour</FieldTitle>
            <FieldDescription>Used for primary buttons, links, focus rings and selection.</FieldDescription>
          </FieldContent>
          <div role="radiogroup" aria-labelledby="accent-label" className="flex flex-wrap gap-2 p-1">
            {ACCENTS.map((option) => {
              const selected = option.value === accent
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={option.label}
                  title={option.label}
                  onClick={() => {
                    setAccent(option.value)
                    applyAccent(option.value)
                  }}
                  // Gr8r's swatch: a 26px dot in the accent (its dark value
                  // in dark mode), ringed when picked, growing on hover.
                  className={cn(
                    'grid size-6.5 cursor-pointer place-items-center rounded-full bg-(--swatch) text-on-fill shadow-[0_0_0_1px_rgb(0_0_0/8%)] outline-none transition-[scale,box-shadow] duration-200 ease-out-quint hover:scale-108 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card active:scale-95 dark:bg-(--swatch-dark)',
                    selected && 'shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--swatch)] dark:shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--swatch-dark)]',
                  )}
                  style={
                    { '--swatch': option.light, '--swatch-dark': option.dark } as React.CSSProperties
                  }
                >
                  {selected && <Check className="size-3.5 animate-pop" strokeWidth={2.5} />}
                </button>
              )
            })}
          </div>
        </Field>

        <Field orientation="horizontal" className="flex-wrap justify-between gap-y-2">
          <FieldContent className="min-w-56">
            <FieldTitle>Frame</FieldTitle>
            <FieldDescription>
              The sidebar, top bar and rim on wide screens: tinted with your accent, or the
              same as the page.
            </FieldDescription>
          </FieldContent>
          <Tabs
            value={frame}
            onValueChange={(value: Frame) => {
              setFrame(value)
              applyFrame(value)
            }}
          >
            <TabsList aria-label="Frame">
              <TabsTrigger value="tint">Tinted</TabsTrigger>
              <TabsTrigger value="plain">Match page</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>

        <Field orientation="horizontal" className="flex-wrap justify-between gap-y-2">
          <FieldContent className="min-w-56">
            <FieldTitle>Motion</FieldTitle>
            <FieldDescription>Reduce turns off page, list and dialog animations.</FieldDescription>
          </FieldContent>
          <Tabs
            value={motion}
            onValueChange={(value: Motion) => {
              setMotion(value)
              applyMotion(value)
            }}
          >
            <TabsList aria-label="Motion">
              <TabsTrigger value="system">Follow system</TabsTrigger>
              <TabsTrigger value="reduce">Reduce</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      </CardContent>
    </Card>
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
            className="flex items-center justify-between gap-3 rounded-lg bg-tile px-4 py-2.5"
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

/**
 * Settings kept on your account (not just this browser): the UPI id friends
 * pay you at, the weekly digest email and your forwarding address for
 * receipts. Signed in only.
 */
function AccountCard() {
  const signedIn = useSession().user !== null
  const { data: profile } = useQuery({
    ...convexQuery(api.profiles.me, {}),
    enabled: signedIn,
  })
  if (!signedIn || !profile) return null
  return <AccountForm profile={profile} />
}

function AccountForm({
  profile,
}: {
  profile: FunctionReturnType<typeof api.profiles.me>
}) {
  const [upi, setUpi] = useState(profile.upiId ?? '')
  const [digest, setDigest] = useState(profile.weeklyDigest)
  const save = useAction(useConvexMutation(api.profiles.update), { success: 'Account saved' })
  const reset = useAction(useConvexMutation(api.profiles.resetInbox), { toastErrors: true })
  return (
    <Card className="mt-[18px]">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void save.run({ upiId: upi.trim() || null, weeklyDigest: digest })
        }}
      >
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Saved to your account, on every device.</CardDescription>
        </CardHeader>
        <CardContent className="mt-4 grid gap-6">
          <Field>
            <FieldLabel htmlFor="upi-id">Your UPI id</FieldLabel>
            <Input
              id="upi-id"
              value={upi}
              placeholder="name@bank"
              maxLength={100}
              onChange={(e) => setUpi(e.target.value)}
              className="sm:w-72"
            />
            <FieldDescription>
              Friends and group members who owe you in INR get a “Pay with UPI” button.
            </FieldDescription>
          </Field>
          <Field orientation="horizontal">
            <Checkbox id="weekly-digest" checked={digest} onCheckedChange={(c) => setDigest(Boolean(c))} />
            <FieldLabel htmlFor="weekly-digest" className="font-normal">
              Email me a weekly digest (Mondays): what I spent and where my balances stand
            </FieldLabel>
          </Field>
          {profile.inboxAvailable && (
            <Field>
              <FieldLabel>Receipt inbox</FieldLabel>
              {profile.inboxAddress ? (
                <code className="justify-self-start rounded-md bg-field px-2 py-1 text-sm">
                  {profile.inboxAddress}
                </code>
              ) : null}
              <FieldDescription>
                Forward receipts and bills here; they show up in Inbox as drafts.
              </FieldDescription>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="justify-self-start"
                disabled={reset.pending}
                onClick={() => void reset.run({})}
              >
                {profile.inboxAddress ? 'Make a new address' : 'Create my address'}
              </Button>
            </Field>
          )}
          {save.error && <p className="text-sm text-destructive">{save.error}</p>}
        </CardContent>
        <CardFooter className="mt-6 justify-end">
          <Button type="submit" size="lg" disabled={save.pending}>
            Save
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
