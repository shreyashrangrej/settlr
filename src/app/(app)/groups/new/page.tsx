import type { Metadata } from 'next'

import { NewGroupView } from './view'

export const metadata: Metadata = { title: 'New group · Settlr' }

// SSR: full. The form renders on the server with neutral defaults; browser
// preferences (localStorage) are applied after hydration in an effect.
export default function NewGroupPage() {
  return <NewGroupView />
}
