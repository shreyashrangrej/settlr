import type { Metadata } from 'next'

import { Prefetched } from '#/components/prefetched'
import { prefetchQuery } from '#/server/convex.server'
import { api } from '#convex/_generated/api'
import { AssistantView } from './view'

export const metadata: Metadata = { title: 'Assistant · Settlr' }

// SSR: full. A chat that adds expenses from plain language ("Add tea
// personal expense 50"). Only whether the assistant is set up is prefetched;
// the conversation lives in the browser.
export default async function AssistantPage() {
  const status = await prefetchQuery(api.assistant.status, {})
  return (
    <Prefetched queries={[status.entry]}>
      <AssistantView />
    </Prefetched>
  )
}
