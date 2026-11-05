'use client'

import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

/**
 * Renders `fallback` on the server and during hydration, then `children`.
 * For UI that depends on the viewer's locale, time zone, clock or browser
 * storage (the old `ssr: 'data-only'`/`ssr: false` routes): the server still
 * prefetches the data, but the markup is only produced in the browser.
 */
export function ClientOnly({
  children,
  fallback = null,
}: {
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
  return mounted ? children : fallback
}
