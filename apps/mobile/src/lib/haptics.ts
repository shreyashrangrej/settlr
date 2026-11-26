import * as Haptics from 'expo-haptics'

import { getPrefs } from '@/lib/prefs'

// Ticks on keys and chips, a firmer thud when money moves. Off with the
// Haptics switch in Profile.

export function tick() {
  if (getPrefs().haptics) safely(() => Haptics.selectionAsync())
}

export function thud() {
  if (getPrefs().haptics) safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success))
}

// Haptics are a nicety: a phone (or the web build the tests use) without
// them just stays still.
function safely(fn: () => Promise<void>) {
  try {
    fn().catch(() => {})
  } catch {}
}
