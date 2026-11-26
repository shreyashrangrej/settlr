import { CURRENCIES, type Currency } from '@settlr/shared/schemas'
import * as SecureStore from 'expo-secure-store'
import { useSyncExternalStore } from 'react'

// Settings that only this phone needs (the web keeps the same ones in
// localStorage): appearance, default currency, haptics, motion, and where
// the last expense went. Kept in secure storage as one JSON value and loaded
// once at start-up, before the splash screen hides.

export type ThemeChoice = 'system' | 'light' | 'dark'

/** Where an expense goes: just you, a friend's ledger or a group. */
export type Target =
  | { kind: 'personal' }
  | { kind: 'friend'; id: string }
  | { kind: 'group'; id: string }

export type Prefs = {
  theme: ThemeChoice
  currency: Currency
  haptics: boolean
  reduceMotion: boolean
  lastTarget: Target
}

export const DEFAULT_PREFS: Prefs = {
  theme: 'system',
  currency: 'INR',
  haptics: true,
  reduceMotion: false,
  lastTarget: { kind: 'personal' },
}

const KEY = 'settlr_prefs'

let prefs: Prefs = DEFAULT_PREFS
const listeners = new Set<() => void>()

/** Reads a stored value, keeping only fields that still make sense. */
export function parsePrefs(raw: string | null): Prefs {
  if (!raw) return DEFAULT_PREFS
  try {
    const value = JSON.parse(raw) as Partial<Prefs>
    const target = value.lastTarget
    return {
      theme: value.theme === 'light' || value.theme === 'dark' ? value.theme : 'system',
      currency: CURRENCIES.includes(value.currency as Currency)
        ? (value.currency as Currency)
        : DEFAULT_PREFS.currency,
      haptics: value.haptics !== false,
      reduceMotion: value.reduceMotion === true,
      lastTarget:
        target &&
        (target.kind === 'personal' ||
          ((target.kind === 'friend' || target.kind === 'group') && typeof target.id === 'string'))
          ? target
          : DEFAULT_PREFS.lastTarget,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

export async function loadPrefs() {
  try {
    prefs = parsePrefs(await SecureStore.getItemAsync(KEY))
  } catch {
    prefs = DEFAULT_PREFS
  }
  listeners.forEach((l) => l())
}

export function getPrefs() {
  return prefs
}

export function setPrefs(patch: Partial<Prefs>) {
  prefs = { ...prefs, ...patch }
  listeners.forEach((l) => l())
  try {
    SecureStore.setItemAsync(KEY, JSON.stringify(prefs)).catch(() => {})
  } catch {
    // No secure storage (the web build the tests use): kept for this session.
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(subscribe, getPrefs, getPrefs)
}
