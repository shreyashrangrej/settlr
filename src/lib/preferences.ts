import { createClientOnlyFn } from '@tanstack/react-start'
import { z } from 'zod'

import { CURRENCIES } from './schemas'

// Per-browser preferences in localStorage. `createClientOnlyFn` is the mirror
// image of `createServerOnlyFn`: calling these during SSR throws, so any
// accidental server-side use fails loudly instead of rendering wrong data.

const STORAGE_KEY = 'settlr:preferences'

export const preferencesSchema = z.object({
  displayName: z.string().trim().max(40).default('').catch(''),
  defaultCurrency: z.enum(CURRENCIES).default('USD').catch('USD'),
})
export type Preferences = z.infer<typeof preferencesSchema>

export const readPreferences = createClientOnlyFn((): Preferences => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return preferencesSchema.parse(raw ? JSON.parse(raw) : {})
  } catch {
    return preferencesSchema.parse({})
  }
})

export const writePreferences = createClientOnlyFn((prefs: Preferences) => {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(preferencesSchema.parse(prefs)),
  )
})
