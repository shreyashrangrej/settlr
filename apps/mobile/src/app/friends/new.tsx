import { api } from '@settlr/backend/convex/_generated/api'
import { addFriendInput } from '@settlr/shared/schemas'
import { useMutation } from 'convex/react'
import { useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { Button } from '@/components/button'
import { Field } from '@/components/controls'
import { Icons } from '@/components/icons'
import { Sheet } from '@/components/overlay'
import { Sub, Text } from '@/components/text'
import { Avatar } from '@/components/tiles'
import { useRun } from '@/lib/actions'
import { firstName } from '@/lib/format'
import { useColors } from '@/theme'

/** Add a friend: a sheet over whatever opened it. */
export default function AddFriendSheet() {
  const colors = useColors()
  const router = useRouter()
  const create = useMutation(api.friends.create)
  const { pending, run } = useRun()
  const [open, setOpen] = useState(true)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<{ name?: string; email?: string }>({})

  const after = useRef<(() => void) | undefined>(undefined)

  // Slide the sheet away, then leave the route (and go on to `then`).
  function close(then?: () => void) {
    after.current = then
    setOpen(false)
  }

  function closed() {
    router.back()
    after.current?.()
  }

  async function submit() {
    const parsed = addFriendInput.safeParse({ name, email: email.trim() })
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      setError({ [issue?.path[0] === 'email' ? 'email' : 'name']: issue?.message })
      return
    }
    setError({})
    const id = await run(
      () => create(parsed.data),
      parsed.data.email ? `Added ${parsed.data.name} and sent a request` : `Added ${parsed.data.name}`,
    )
    if (id) close(() => router.push(`/friends/${id}`))
  }

  const who = firstName(name) || 'them'
  return (
    <Sheet open={open} onClose={() => close()} onClosed={closed} label="Add a friend">
      <View style={styles.head}>
        <Avatar name={name || '?'} size="xl" />
        <View style={styles.grow}>
          <Text accessibilityRole="header" display weight={700} size={26} lineHeight={32}>
            Add a friend
          </Text>
          <Sub>For expenses with just the two of you</Sub>
        </View>
      </View>
      <View style={styles.form}>
        <Field
          label="Name"
          value={name}
          onChangeText={(t) => {
            setName(t)
            setError({})
          }}
          placeholder="Neha Joshi"
          autoFocus
          autoCapitalize="words"
          error={error.name}
          returnKeyType="next"
        />
        <Field
          label="Email (optional)"
          value={email}
          onChangeText={(t) => {
            setEmail(t)
            setError({})
          }}
          placeholder="neha@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          error={error.email}
          onSubmitEditing={submit}
        />
        {email.trim() ? (
          <View style={[styles.note, { backgroundColor: colors.accentSoft }]}>
            <Icons.verified color={colors.accentInk} size={18} />
            <Text weight={600} size={13.5} lineHeight={19} color="accentInk" style={styles.grow}>
              We'll send {who} a friend request. Once it's accepted, you both see the same ledger and get each other's updates.
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.actions}>
        <Button wide icon={Icons.userPlus} onPress={submit} loading={pending} style={{ height: 56 }}>
          {email.trim() ? 'Add and send request' : 'Add friend'}
        </Button>
      </View>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 10 },
  form: { paddingHorizontal: 20, paddingTop: 20, gap: 16 },
  note: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 18 },
  actions: { paddingHorizontal: 16, paddingTop: 20 },
})
