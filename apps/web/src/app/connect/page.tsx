import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { LoginForm } from '#/components/login-form'
import { Prefetched } from '#/components/prefetched'
import { connectSearchSchema } from '@settlr/shared/schemas'
import { parseSearch } from '#/lib/search'
import { getAuthSession } from '#/server/auth.server'
import { prefetchQuery } from '#/server/convex.server'
import { api } from '@settlr/backend/convex/_generated/api'
import { ConnectView, UnknownApp } from './view'

export const metadata: Metadata = { title: 'Connect an app · Settlr', robots: { index: false } }

type Props = { searchParams: Promise<Record<string, string | Array<string> | undefined>> }

// SSR: full. Where MCP clients (Claude, ChatGPT, ...) send people to
// connect to Settlr. Better Auth's /mcp/authorize sends them here twice
// (see `mcpBridge` in convex/auth.ts): first to sign in, if they aren't,
// then with a `consent_code` to approve the app. Everything else in the
// query is OAuth state, passed back to /mcp/authorize untouched.
export default async function ConnectPage({ searchParams }: Props) {
  const params = await searchParams
  const { client_id: clientId, consent_code: consentCode } = parseSearch(
    connectSearchSchema,
    params,
  )
  // Opened directly: setting up a connection starts in the other app.
  if (!clientId) redirect('/settings')

  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    for (const item of [value ?? []].flat()) query.append(key, item)
  }

  const { user } = await getAuthSession()
  if (!user) {
    return (
      <div className="mx-auto grid max-w-md gap-5 py-6">
        <p className="text-center text-sm text-muted-foreground">
          Sign in to connect an app to your Settlr account.
        </p>
        <LoginForm next={`/connect?${query}`} />
      </div>
    )
  }
  // Signed in: back to the authorization, which asks for approval here.
  if (!consentCode) redirect(`/api/auth/mcp/authorize?${query}`)

  const app = await prefetchQuery(api.mcp.client, { clientId })
  if (!app.data) return <UnknownApp />
  return (
    <Prefetched queries={[app.entry]}>
      <ConnectView clientId={clientId} consentCode={consentCode} />
    </Prefetched>
  )
}
