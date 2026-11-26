import type { Metadata } from 'next'

import { ClientOnly } from '#/components/client-only'
import { SharedGroupView } from './view'

export const metadata: Metadata = { title: 'Shared group · Settlr', robots: { index: false } }

type Props = { params: Promise<{ token: string }> }

// A group's read-only page behind its share link: no sign-in, nothing to
// change. Loaded in the browser (it's public data, nothing to prefetch as
// anyone).
export default async function SharePage({ params }: Props) {
  const { token } = await params
  return (
    <ClientOnly>
      <SharedGroupView token={token} />
    </ClientOnly>
  )
}
