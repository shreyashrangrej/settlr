import { Platform, type PressableAndroidRippleConfig } from 'react-native'

import { withAlpha } from '@/lib/color'
import { useColors } from '@/theme'

/**
 * Android draws a native ripple on press: a wash that spreads from the
 * finger (React Native's `android_ripple`, so it runs on the UI thread and
 * works in Expo Go). Elsewhere (the web build the tests use) there is no
 * ripple, so pressables keep a fallback (`pressedStyle`).
 */
export const RIPPLES = Platform.OS === 'android'

type RippleOptions = { borderless?: boolean; radius?: number; strength?: number }

/**
 * The ripple for a pressable, drawn in its content colour (`on`) so it
 * shows on any fill: a dark wash on paper, a white one on violet or red.
 * `borderless` spreads past a bare icon's bounds as a circle of `radius`.
 * Bounded ripples follow the view's corners when it has
 * `overflow: 'hidden'`. A plain function, so it can be used in a `.map`.
 */
export function ripple(
  on: string,
  { borderless = false, radius, strength = 0.14 }: RippleOptions = {},
): PressableAndroidRippleConfig | undefined {
  if (!RIPPLES) return undefined
  return {
    color: on.startsWith('#') && on.length === 7 ? withAlpha(on, strength) : on,
    borderless,
    radius,
    foreground: !borderless,
  }
}

/** `ripple()` in the theme's text colour unless `on` says otherwise. */
export function useRipple(on?: string, options?: RippleOptions) {
  const colors = useColors()
  return ripple(on ?? colors.text, options)
}

/** The press look where there's no ripple: `style={({ pressed }) => [..., pressedStyle(pressed)]}`. */
export function pressedStyle(pressed: boolean, opacity = 0.6) {
  return pressed && !RIPPLES ? { opacity } : null
}
