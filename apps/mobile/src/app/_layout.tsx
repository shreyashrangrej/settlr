import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
} from '@expo-google-fonts/geist'
import {
  GeistMono_400Regular,
  GeistMono_500Medium,
  GeistMono_600SemiBold,
} from '@expo-google-fonts/geist-mono'
import { ConvexProvider } from 'convex/react'
import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import * as SystemUI from 'expo-system-ui'
import { useEffect } from 'react'

import { convex } from '@/lib/convex'
import { useColors, useIsDark } from '@/theme'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const colors = useColors()
  const isDark = useIsDark()
  const [fontsLoaded, fontError] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    GeistMono_400Regular,
    GeistMono_500Medium,
    GeistMono_600SemiBold,
  })
  const ready = fontsLoaded || fontError !== null

  // The window behind the screens, so transitions never flash white.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg)
  }, [colors.bg])

  useEffect(() => {
    if (ready) SplashScreen.hideAsync()
  }, [ready])

  if (!ready) return null

  return (
    <ConvexProvider client={convex}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </ConvexProvider>
  )
}
