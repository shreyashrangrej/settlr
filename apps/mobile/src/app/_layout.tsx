import {
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque'
import {
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope'
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react'
import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import * as SystemUI from 'expo-system-ui'
import { useEffect, useState } from 'react'

import { DialogHost, ToastHost } from '@/components/overlay'
import { authClient } from '@/lib/auth-client'
import { convex } from '@/lib/convex'
import { loadPrefs } from '@/lib/prefs'
import { useColors, useIsDark } from '@/theme'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const colors = useColors()
  const isDark = useIsDark()
  const [fontsLoaded, fontError] = useFonts({
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
  })
  const [prefsLoaded, setPrefsLoaded] = useState(false)
  useEffect(() => {
    loadPrefs().finally(() => setPrefsLoaded(true))
  }, [])
  // The Expo plugin restores the last session from secure storage at once,
  // so this only waits on a first launch (or after signing out).
  const { data: session, isPending } = authClient.useSession()
  const signedIn = session != null
  const ready = (fontsLoaded || fontError !== null) && prefsLoaded && (signedIn || !isPending)

  // The window behind the screens, so transitions never flash white.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg)
  }, [colors.bg])

  useEffect(() => {
    if (ready) SplashScreen.hideAsync()
  }, [ready])

  if (!ready) return null

  const sheet = { presentation: 'transparentModal', animation: 'none', contentStyle: { backgroundColor: 'transparent' } } as const
  const up = { animation: 'slide_from_bottom', contentStyle: { backgroundColor: colors.surface } } as const

  return (
    <ConvexBetterAuthProvider client={convex} authClient={authClient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {/* Signing in or out flips the guards, and the router moves to the
          first screen that's allowed: the tabs or Welcome. */}
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="add" options={up} />
          <Stack.Screen name="settle" options={sheet} />
          <Stack.Screen name="settled" options={{ animation: 'fade' }} />
          <Stack.Screen name="groups/new" options={up} />
          <Stack.Screen name="groups/[groupId]/index" />
          <Stack.Screen name="groups/[groupId]/balances" />
          <Stack.Screen name="friends/new" options={sheet} />
          <Stack.Screen name="friends/[friendId]" />
          <Stack.Screen name="expense" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="budget" />
          <Stack.Screen name="assistant" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="welcome" options={{ contentStyle: { backgroundColor: colors.hero } }} />
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="verify" />
        </Stack.Protected>
      </Stack>
      <ToastHost />
      <DialogHost />
    </ConvexBetterAuthProvider>
  )
}
