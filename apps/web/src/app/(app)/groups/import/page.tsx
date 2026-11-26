import type { Metadata } from 'next'

import { ImportView } from './view'

export const metadata: Metadata = { title: 'Import from Splitwise · Settlr' }

// The file is read in the browser; nothing to prefetch.
export default function ImportPage() {
  return <ImportView />
}
