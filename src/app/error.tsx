'use client'

import { ErrorState } from '#/components/states'

// Errors thrown while rendering a page (or loading its data) land here,
// inside the root layout, so the header stays.
export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return <ErrorState error={error} reset={reset} />
}
