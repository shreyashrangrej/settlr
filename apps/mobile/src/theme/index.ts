import { useEffect, useState } from 'react'
import { AccessibilityInfo, useColorScheme } from 'react-native'

import { usePrefs } from '@/lib/prefs'

import { dark, light, type Colors } from './tokens'

export * from './tokens'

/** Dark when the viewer picked it in Profile, or the phone is set to dark. */
export function useIsDark() {
  const scheme = useColorScheme()
  const { theme } = usePrefs()
  return theme === 'system' ? scheme === 'dark' : theme === 'dark'
}

export function useColors(): Colors {
  return useIsDark() ? dark : light
}

/** Android's Remove animations, or the Reduce motion switch in Profile. */
export function useReduceMotion() {
  const { reduceMotion } = usePrefs()
  const [system, setSystem] = useState(false)
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setSystem)
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystem)
    return () => sub.remove()
  }, [])
  return reduceMotion || system
}
