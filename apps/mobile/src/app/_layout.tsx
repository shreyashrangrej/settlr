import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans'
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react'
import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import * as SystemUI from 'expo-system-ui'
import { useEffect } from 'react'

import { authClient } from '@/lib/auth-client'
import { convex } from '@/lib/convex'
import { useColors, useIsDark } from '@/theme'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const colors = useColors()
  const isDark = useIsDark()
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  })
  // The Expo plugin restores the last session from secure storage at once,
  // so this only waits on a first launch (or after signing out).
  const { data: session, isPending } = authClient.useSession()
  const signedIn = session != null
  const ready = (fontsLoaded || fontError !== null) && (signedIn || !isPending)

  // The window behind the screens, so transitions never flash white.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg)
  }, [colors.bg])

  useEffect(() => {
    if (ready) SplashScreen.hideAsync()
  }, [ready])

  if (!ready) return null

  return (
    <ConvexBetterAuthProvider client={convex} authClient={authClient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {/* Signing in or out flips the guards, and the router moves to the
          first screen that's allowed: the tabs or sign-in. */}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="verify" />
        </Stack.Protected>
      </Stack>
    </ConvexBetterAuthProvider>
  )
}
