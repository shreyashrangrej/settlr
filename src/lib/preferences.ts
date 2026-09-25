import { z } from 'zod'

import { CURRENCIES } from './schemas'

// Per-browser preferences in localStorage. They only exist in the browser:
// calling these during SSR throws, so any accidental server-side use fails
// loudly instead of rendering wrong data. Read them in effects, event
// handlers or client-only components.

const STORAGE_KEY = 'settlr:preferences'

export const preferencesSchema = z.object({
  defaultCurrency: z.enum(CURRENCIES).default('USD').catch('USD'),
})
export type Preferences = z.infer<typeof preferencesSchema>

function assertBrowser(name: string) {
  if (typeof window === 'undefined') {
    throw new Error(`${name}() reads localStorage and can only run in the browser.`)
  }
}

export function readPreferences(): Preferences {
  assertBrowser('readPreferences')
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return preferencesSchema.parse(raw ? JSON.parse(raw) : {})
  } catch {
    return preferencesSchema.parse({})
  }
}

export function writePreferences(prefs: Preferences) {
  assertBrowser('writePreferences')
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(preferencesSchema.parse(prefs)),
  )
}
