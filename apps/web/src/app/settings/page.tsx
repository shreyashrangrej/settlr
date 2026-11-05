import type { Metadata } from 'next'

import { ClientOnly } from '#/components/client-only'
import { PageSkeleton } from '#/components/skeletons'
import { SettingsView } from './view'

export const metadata: Metadata = { title: 'Settings · Settlr' }

// Rendered in the browser only: preferences live in localStorage, so the
// server sends a skeleton in its place.
export default function SettingsPage() {
  return (
    <ClientOnly fallback={<PageSkeleton />}>
      <SettingsView />
    </ClientOnly>
  )
}
