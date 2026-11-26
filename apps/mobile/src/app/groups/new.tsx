import { api } from '@settlr/backend/convex/_generated/api'
import { CURRENCIES, createGroupInput, type Currency } from '@settlr/shared/schemas'
import { useMutation, useQuery } from 'convex/react'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Button, IconButton } from '@/components/button'
import { Chip, ChipRow } from '@/components/controls'
import { Icons } from '@/components/icons'
import { TopBar } from '@/components/screen'
import { Rise, Row } from '@/components/surfaces'
import { Label, Sub, Text } from '@/components/text'
import { Avatar, Badge, Tile } from '@/components/tiles'
import { useRun } from '@/lib/actions'
import { currencySymbol, firstName, toneFor } from '@/lib/format'
import { useMe } from '@/lib/me'
import { usePrefs } from '@/lib/prefs'
import { fonts, useColors } from '@/theme'

const MAX_MEMBERS = 20

export default function NewGroupScreen() {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const me = useMe()
  const prefs = usePrefs()
  const friends = useQuery(api.friends.list)
  const create = useMutation(api.groups.create)
  const { pending, run } = useRun()
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState<Currency>(prefs.currency)
  const [members, setMembers] = useState<Array<string>>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  const taken = new Set(members.map((m) => m.toLowerCase()))
  const suggestions = (friends ?? []).filter((f) => !taken.has(f.name.toLowerCase())).slice(0, 12)

  function addMember(value = draft) {
    const trimmed = value.trim()
    if (!trimmed) return
    if (taken.has(trimmed.toLowerCase())) {
      setError(`${trimmed} is already in the group.`)
      return
    }
    if (members.length + 1 >= MAX_MEMBERS) {
      setError(`A group can have up to ${MAX_MEMBERS} people.`)
      return
    }
    setMembers((m) => [...m, trimmed])
    setDraft('')
    setError(null)
  }

  async function submit() {
    const all = draft.trim() ? [...members, draft.trim()] : members
    const parsed = createGroupInput.safeParse({ name: name.trim(), currency, members: all })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the group’s details.')
      return
    }
    setError(null)
    const id = await run(() => create(parsed.data))
    if (id) {
      router.dismiss()
      router.push(`/groups/${id}`)
    }
  }

  const letter = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.flex, { backgroundColor: colors.surface }]}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 4, paddingBottom: 20 }}>
        <TopBar close title="New group" />
        <Rise index={1} style={styles.nameRow}>
          <Tile hue={toneFor(name || 'new')} size={64} radius={22} letter={letter} />
          <View style={styles.grow}>
            <Text weight={700} size={13} color="muted">
              Name
            </Text>
            <TextInput
              accessibilityLabel="Group name"
              value={name}
              onChangeText={setName}
              placeholder="Goa trip, Flat 4B…"
              placeholderTextColor={colors.dim}
              autoFocus
              maxLength={60}
              selectionColor={colors.accent}
              style={[styles.nameInput, { color: colors.text, borderBottomColor: colors.accent }]}
            />
          </View>
        </Rise>

        <Text weight={700} size={13} color="muted" style={styles.label}>
          Currency
        </Text>
        <Rise index={2}>
          <ChipRow>
            {CURRENCIES.map((c) => (
              <Chip
                key={c}
                tone={c === currency ? 'on' : 'neutral'}
                icon={c === currency ? Icons.check : undefined}
                selected={c === currency}
                onPress={() => setCurrency(c)}
              >
                {`${currencySymbol(c)} ${c}`}
              </Chip>
            ))}
          </ChipRow>
        </Rise>
        <Sub size={12.5} style={styles.hint}>
          Every expense in the group uses it.
        </Sub>

        <View style={styles.membersHead}>
          <Text weight={700} size={13} color="muted">
            Members
          </Text>
          <Label>
            {members.length + 1} of {MAX_MEMBERS}
          </Label>
        </View>
        <Rise index={3}>
          <Row
            minHeight={58}
            style={styles.memberRow}
            leading={<Avatar name={me.name || me.email} me size="sm" />}
            title="You"
            titleSize={15}
            end={<Badge>always in</Badge>}
          />
          {members.map((m, i) => (
            <Row
              key={`${m}-${i}`}
              minHeight={58}
              style={styles.memberRow}
              leading={<Avatar name={m} size="sm" />}
              title={m}
              titleSize={15}
              end={
                <IconButton
                  icon={Icons.x}
                  label={`Remove ${m}`}
                  size={36}
                  iconSize={18}
                  color={colors.faint}
                  onPress={() => setMembers((all) => all.filter((_, j) => j !== i))}
                />
              }
            />
          ))}
          <View style={styles.addRow}>
            <View style={[styles.addField, { backgroundColor: colors.surface2 }]}>
              <Icons.userPlus color={colors.faint} size={18} />
              <TextInput
                accessibilityLabel="Add a member"
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={() => addMember()}
                blurOnSubmit={false}
                returnKeyType="done"
                placeholder="Add a name"
                placeholderTextColor={colors.faint}
                selectionColor={colors.accent}
                style={[styles.addInput, { color: colors.text }]}
              />
              <IconButton
                icon={Icons.plus}
                label="Add"
                size={40}
                iconSize={18}
                bg={colors.accent}
                color={colors.onAccent}
                onPress={() => addMember()}
                disabled={!draft.trim()}
              />
            </View>
          </View>
        </Rise>

        {suggestions.length > 0 ? (
          <>
            <Text weight={700} size={13} color="muted" style={styles.label}>
              From your friends
            </Text>
            <ChipRow>
              {suggestions.map((f) => (
                <Chip key={f.id} leading={<Avatar id={f.id} name={f.name} size="xs" />} iconRight={Icons.plus} onPress={() => addMember(f.name)}>
                  {firstName(f.name)}
                </Chip>
              ))}
            </ChipRow>
          </>
        ) : null}
        <Sub style={styles.note}>Members are just names. They don't need a Settlr account.</Sub>
        {error ? (
          <Text weight={600} size={14} color="owe" style={styles.note} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
        <Button wide icon={Icons.check} onPress={submit} loading={pending} disabled={!name.trim()} style={{ height: 56 }}>
          Create group
        </Button>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flex: 1, minWidth: 0, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 8 },
  nameInput: {
    borderBottomWidth: 2,
    paddingTop: 4,
    paddingBottom: 8,
    fontFamily: fonts.display[700],
    fontSize: 26,
    letterSpacing: -0.5,
  },
  label: { paddingHorizontal: 20, paddingTop: 26, paddingBottom: 10 },
  hint: { paddingHorizontal: 20, paddingTop: 8 },
  membersHead: {
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberRow: { paddingVertical: 8, paddingHorizontal: 20 },
  addRow: { paddingHorizontal: 16, paddingTop: 8 },
  addField: { height: 52, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 16, paddingRight: 6 },
  addInput: { flex: 1, fontFamily: fonts.sans[600], fontSize: 15.5 },
  note: { paddingHorizontal: 20, paddingTop: 14 },
  footer: { paddingHorizontal: 16, paddingTop: 12 },
})
