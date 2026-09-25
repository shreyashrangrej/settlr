import type { Metadata } from 'next'

import { NewExpenseView } from './view'

export const metadata: Metadata = { title: 'Add expense · Settlr' }

// SSR: full. The form needs no data beyond the group, which the layout has
// already loaded.
export default function NewExpensePage() {
  return <NewExpenseView />
}
