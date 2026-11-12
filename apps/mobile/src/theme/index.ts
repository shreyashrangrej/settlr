import { useColorScheme } from 'react-native'

import { dark, light, type Colors } from './tokens'

export * from './tokens'

/** The palette for the phone's light or dark setting (dark when unknown). */
export function useColors(): Colors {
  return useColorScheme() === 'light' ? light : dark
}

export function useIsDark() {
  return useColorScheme() !== 'light'
}
