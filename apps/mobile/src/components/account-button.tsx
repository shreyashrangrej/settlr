import { api } from '@settlr/backend/convex/_generated/api'
import { useQuery } from 'convex/react'
import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

import { Button } from '@/components/button'
import { Text } from '@/components/text'
import { authClient, errorMessage, signOut } from '@/lib/auth-client'
import { radius, useColors } from '@/theme'

/** The signed-in user, read through Convex (so it also shows the Convex client is signed in). */
export function useCurrentUser() {
  const { data: session } = authClient.useSession()
  const user = useQuery(api.auth.getCurrentUser)
  const fallback = session?.user
  return {
    name: (user?.name ?? fallback?.name ?? '').trim(),
    email: user?.email ?? fallback?.email ?? '',
  }
}

export function initials(name: string, email: string) {
  const words = name.split(/\s+/).filter(Boolean)
  const letters = words.length > 1 ? words[0]![0]! + words[words.length - 1]![0]! : (words[0] ?? email).slice(0, 2)
  return letters.toUpperCase()
}

/** The avatar in Home's header: a solid accent circle with the user's initials. */
export function AccountAvatar({ open, onPress }: { open: boolean; onPress: () => void }) {
  const colors = useColors()
  const { name, email } = useCurrentUser()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Account"
      accessibilityState={{ expanded: open }}
      onPress={onPress}
      style={styles.hit}
    >
      <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
        <Text size={13} weight={500} style={{ color: colors.onAccent }}>
          {initials(name, email)}
        </Text>
      </View>
    </Pressable>
  )
}

/** For now: who's signed in, and Sign out. Settings get a real screen later. */
export function AccountCard() {
  const colors = useColors()
  const { name, email } = useCurrentUser()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // On success the session clears and the root layout goes back to sign-in.
  async function onSignOut() {
    setPending(true)
    setError(null)
    try {
      await signOut()
    } catch (err) {
      setError(errorMessage(err))
      setPending(false)
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.who}>
        <Text weight={500}>{name || 'No name yet'}</Text>
        <Text size={13} color="muted">
          {email}
        </Text>
      </View>
      {error ? (
        <Text size={14} color="owe">
          {error}
        </Text>
      ) : null}
      <Button variant="outline" size="md" onPress={onSignOut} loading={pending}>
        Sign out
      </Button>
    </View>
  )
}

const styles = StyleSheet.create({
  hit: { width: 48, height: 48, marginRight: -7, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: radius.tile, borderWidth: 1, padding: 16, gap: 12 },
  who: { gap: 2 },
})
