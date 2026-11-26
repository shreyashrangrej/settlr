import { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { api } from '@settlr/backend/convex/_generated/api'
import type { Id } from '@settlr/backend/convex/_generated/dataModel'
import type { Currency } from '@settlr/shared/schemas'
import { useMutation, useQuery } from 'convex/react'
import * as Linking from 'expo-linking'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState, type ComponentRef } from 'react'
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'

import { Button, IconButton } from '@/components/button'
import { Chip } from '@/components/controls'
import { Icons } from '@/components/icons'
import { Sheet } from '@/components/overlay'
import { SlideToConfirm } from '@/components/slider'
import { Row } from '@/components/surfaces'
import { Label, Sub, Text } from '@/components/text'
import { Avatar, Badge } from '@/components/tiles'
import { errorText } from '@/lib/actions'
import { currencySymbol, dateChip, firstName, localIsoDate, money } from '@/lib/format'
import { thud } from '@/lib/haptics'
import { amountCents, centsToAmount } from '@/lib/keypad'
import { fonts, useColors, useReduceMotion } from '@/theme'

type Params = {
  kind: 'friend' | 'group'
  id: string
  /** Friend: the currency to settle. */
  currency?: string
  /** Group: the plan's payment (member ids and cents; 0 to pick it here). */
  from?: string
  to?: string
  amount?: string
}

type Party = { id: string; name: string; me: boolean }

/** Settle up: a sheet with who pays whom, the amount, and Slide to record. */
export default function SettleScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<Params>()
  const [open, setOpen] = useState(true)
  const closing = useRef(false)

  function close(then?: () => void) {
    if (closing.current) return
    closing.current = true
    setOpen(false)
    setTimeout(() => (then ? then() : router.back()), 240)
  }

  return (
    <Sheet open={open} onClose={() => close()} height={0.88} label="Settle up">
      {params.kind === 'group' ? (
        <GroupSettle params={params} close={close} />
      ) : (
        <FriendSettle params={params} close={close} />
      )}
    </Sheet>
  )
}

function FriendSettle({ params, close }: { params: Params; close: (then?: () => void) => void }) {
  const router = useRouter()
  const friend = useQuery(api.friends.get, { friendId: params.id })
  const addPayment = useMutation(api.friends.addPayment)
  const currency = (params.currency || Object.keys(friend?.balances ?? {})[0] || 'INR') as Currency
  const balance = friend?.balances[currency] ?? 0
  const [swap, setSwap] = useState(false)
  // You owe them (negative): you pay. They owe you: they pay.
  const youPay = balance < 0 ? !swap : swap
  if (!friend) return <Loading />
  const me: Party = { id: 'me', name: 'You', me: true }
  const them: Party = { id: friend.id, name: friend.name, me: false }
  return (
    <SettleBody
      from={youPay ? me : them}
      to={youPay ? them : me}
      currency={currency}
      owedCents={Math.abs(balance)}
      upiId={youPay && currency === 'INR' ? friend.upiId : null}
      onSwap={() => setSwap((s) => !s)}
      withNote
      afterLine={(paid) => {
        const after = balance + (youPay ? paid : -paid)
        return after
      }}
      onRecord={async ({ cents, date, note }) => {
        await addPayment({
          friendId: friend.id,
          amountCents: cents,
          currency,
          paidBy: youPay ? 'me' : 'friend',
          note: note || undefined,
          date,
        })
        const after = balance + (youPay ? cents : -cents)
        close(() =>
          router.replace({
            pathname: '/settled',
            params: {
              name: friend.name,
              amount: String(cents),
              currency,
              before: String(balance),
              after: String(after),
              youPaid: youPay ? '1' : '',
              href: `/friends/${friend.id}`,
              note,
              linked: friend.status === 'linked' ? '1' : '',
            },
          }),
        )
      }}
    />
  )
}

function GroupSettle({ params, close }: { params: Params; close: (then?: () => void) => void }) {
  const router = useRouter()
  const group = useQuery(api.groups.get, { groupId: params.id })
  const addPayment = useMutation(api.groups.addPayment)
  const [from, setFrom] = useState(params.from ?? '')
  const [to, setTo] = useState(params.to ?? '')
  if (!group) return <Loading />
  const meId = group.meMemberId
  const party = (id: string): Party => {
    const m = group.members.find((x) => x.id === id)
    return { id, name: id === meId ? 'You' : (m?.name ?? 'Someone'), me: id === meId }
  }
  const planned = group.settlements.find((s) => s.from === from && s.to === to)?.amountCents ?? 0
  const myNet = group.members.find((m) => m.id === meId)?.netCents ?? 0
  const pick = Number(params.amount ?? 0) === 0
  return (
    <SettleBody
      from={party(from)}
      to={party(to)}
      currency={group.currency}
      owedCents={planned}
      upiId={from === meId && group.currency === 'INR' ? (group.members.find((m) => m.id === to)?.upiId ?? null) : null}
      onSwap={() => {
        setFrom(to)
        setTo(from)
      }}
      members={pick ? group.members.map((m) => party(m.id)) : undefined}
      onPickFrom={setFrom}
      onPickTo={setTo}
      kicker={group.name}
      afterLine={(paid) => (from === meId ? myNet + paid : to === meId ? myNet - paid : null)}
      onRecord={async ({ cents, date }) => {
        await addPayment({ groupId: group.id as Id<'groups'>, from, to, amountCents: cents, date })
        const mine = from === meId || to === meId
        const other = from === meId ? party(to) : party(from)
        close(() =>
          router.replace({
            pathname: '/settled',
            params: {
              name: mine ? other.name : `${party(from).name} and ${party(to).name}`,
              amount: String(cents),
              currency: group.currency,
              before: String(mine ? myNet : 0),
              after: String(mine ? (from === meId ? myNet + cents : myNet - cents) : 0),
              youPaid: from === meId ? '1' : '',
              href: `/groups/${group.id}`,
              group: group.name,
              mine: mine ? '1' : '',
              linked: '1',
            },
          }),
        )
      }}
    />
  )
}

function SettleBody({
  from,
  to,
  currency,
  owedCents,
  upiId,
  onSwap,
  withNote = false,
  members,
  onPickFrom,
  onPickTo,
  kicker,
  afterLine,
  onRecord,
}: {
  from: Party
  to: Party
  currency: Currency
  owedCents: number
  upiId: string | null | undefined
  onSwap: () => void
  withNote?: boolean
  members?: Array<Party>
  onPickFrom?: (id: string) => void
  onPickTo?: (id: string) => void
  kicker?: string
  afterLine: (paidCents: number) => number | null
  onRecord: (payment: { cents: number; date: string; note: string }) => Promise<void>
}) {
  const colors = useColors()
  const today = localIsoDate()
  const [part, setPart] = useState(owedCents === 0)
  const [typed, setTyped] = useState(owedCents ? centsToAmount(owedCents) : '')
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<ComponentRef<typeof TextInput>>(null)

  useEffect(() => {
    if (!part) setTyped(owedCents ? centsToAmount(owedCents) : '')
  }, [owedCents, part])

  const cents = part ? amountCents(typed) : owedCents
  const after = afterLine(cents)
  const youPay = from.me
  const verb = from.me ? 'pay' : 'pays'

  async function record() {
    if (cents <= 0) {
      setError('Enter how much was paid.')
      setPart(true)
      return
    }
    if (from.id === to.id) {
      setError('Pick two different people.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      await onRecord({ cents, date, note: note.trim() })
      thud()
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  function pickDate() {
    if (Platform.OS !== 'android') return
    DateTimePickerAndroid.open({
      value: new Date(`${date}T12:00:00`),
      mode: 'date',
      maximumDate: new Date(),
      onChange: (event, value) => {
        if (event.type === 'set' && value) setDate(localIsoDate(value))
      },
    })
  }

  const stance = from.me ? 'you owe' : to.me ? 'owes you' : `${firstName(from.name)} owes`
  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 8 }}>
      <View style={styles.head}>
        <View>
          {kicker ? <Label>{kicker}</Label> : null}
          <Text accessibilityRole="header" display weight={700} size={26} lineHeight={32}>
            Settle up
          </Text>
        </View>
        {owedCents > 0 ? (
          <Badge tone={from.me ? 'owe' : 'owed'}>{`${stance} ${money(owedCents, currency)}`}</Badge>
        ) : null}
      </View>

      <View style={styles.flow}>
        <PartyView party={from} />
        <View style={styles.arrow}>
          <Flow />
          <Label>{verb}</Label>
          <Pressable accessibilityRole="button" accessibilityLabel="Swap who paid" onPress={onSwap} hitSlop={8} style={[styles.swap, { backgroundColor: colors.surface2 }]}>
            <Icons.swap color={colors.muted} size={15} />
          </Pressable>
        </View>
        <PartyView party={to} />
      </View>

      {members ? (
        <View style={{ gap: 8, marginTop: 14 }}>
          <MemberPicker label="From" members={members} value={from.id} onPick={onPickFrom!} />
          <MemberPicker label="To" members={members} value={to.id} onPick={onPickTo!} />
        </View>
      ) : null}

      <View style={styles.amount}>
        {part ? (
          <View style={styles.amountEdit}>
            <Text display weight={700} size={34} color="faint">
              {currencySymbol(currency)}
            </Text>
            <TextInput
              ref={input}
              accessibilityLabel="Amount paid"
              value={typed}
              onChangeText={(t) => setTyped(t.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              autoFocus={owedCents === 0}
              placeholder="0"
              placeholderTextColor={colors.dim}
              selectionColor={colors.accent}
              style={[styles.amountInput, { color: colors.text }]}
            />
          </View>
        ) : (
          <>
            <Text display weight={800} size={60} lineHeight={66} tracking={-0.05} tabular adjustsFontSizeToFit numberOfLines={1}>
              {money(cents, currency)}
            </Text>
            <IconButton
              icon={Icons.pen}
              tone="neutral"
              size={36}
              iconSize={17}
              label="Change amount"
              onPress={() => {
                setPart(true)
                setTimeout(() => input.current?.focus(), 50)
              }}
            />
          </>
        )}
      </View>
      {owedCents > 0 ? (
        <View style={styles.modes}>
          <Chip tone={!part ? 'on' : 'neutral'} icon={!part ? Icons.check : undefined} selected={!part} onPress={() => setPart(false)}>
            Full balance
          </Chip>
          <Chip
            tone={part ? 'on' : 'neutral'}
            icon={part ? Icons.check : undefined}
            selected={part}
            onPress={() => {
              setPart(true)
              setTimeout(() => input.current?.focus(), 50)
            }}
          >
            Part of it
          </Chip>
        </View>
      ) : null}

      <View style={[styles.details, { backgroundColor: colors.surface2 }]}>
        <Row
          minHeight={56}
          style={styles.detailRow}
          leading={<Icons.cal color={colors.muted} size={18} />}
          title={dateChip(date, today)}
          titleSize={15}
          end={<Icons.chevR color={colors.faint} size={18} />}
          onPress={pickDate}
          accessibilityLabel={`Date: ${dateChip(date, today)}`}
        />
        {withNote ? (
          <View style={[styles.noteRow, { borderTopColor: colors.divider }]}>
            <Icons.pen color={colors.muted} size={18} />
            <TextInput
              accessibilityLabel="Note"
              value={note}
              onChangeText={setNote}
              placeholder="Paid on UPI, cash…"
              placeholderTextColor={colors.faint}
              maxLength={80}
              selectionColor={colors.accent}
              style={[styles.noteInput, { color: colors.text }]}
            />
            <Label>Note</Label>
          </View>
        ) : null}
      </View>

      {after !== null && cents > 0 ? (
        <View style={styles.after}>
          <Sub weight={600}>Afterwards</Sub>
          <Icons.arrowR color={colors.faint} size={15} />
          {after === 0 ? (
            <View style={styles.row}>
              <Icons.check color={colors.owed} size={15} />
              <Text weight={700} size={14} color={colors.owed}>
                all square
              </Text>
            </View>
          ) : (
            <Text weight={700} size={14} tabular color={after > 0 ? colors.owed : colors.owe}>
              {after > 0 ? `you’re owed ${money(after, currency)}` : `you owe ${money(after, currency)}`}
            </Text>
          )}
        </View>
      ) : null}

      {upiId && youPay && cents > 0 ? (
        <View style={[styles.upi, { borderColor: colors.surface3 }]}>
          <View style={styles.flex}>
            <Text weight={800} size={14.5}>
              Pay first, then record it
            </Text>
            <Sub size={12.5} lineHeight={17}>
              Opens GPay, PhonePe or any UPI app with {money(cents, currency)} filled in
            </Sub>
          </View>
          <Button
            size="md"
            variant="tonal"
            icon={Icons.phone}
            onPress={() =>
              Linking.openURL(
                `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(to.name)}&am=${(cents / 100).toFixed(2)}&cu=INR&tn=${encodeURIComponent('Settlr')}`,
              ).catch(() => setError('No UPI app on this phone.'))
            }
          >
            Pay with UPI
          </Button>
        </View>
      ) : null}

      {error ? (
        <Text weight={700} size={13.5} color="owe" align="center" style={{ marginTop: 12, paddingHorizontal: 16 }} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <View style={styles.slide}>
        <SlideToConfirm label={`Slide to record ${money(cents, currency)}`} onConfirm={record} busy={busy} disabled={cents <= 0} />
      </View>
      <Sub align="center" style={styles.foot}>
        {to.me
          ? 'The balance moves now.'
          : `The balance moves now. ${firstName(to.name)} is asked to confirm they got it.`}
      </Sub>
    </ScrollView>
  )
}

function PartyView({ party }: { party: Party }) {
  return (
    <View style={styles.party}>
      <Avatar id={party.id} name={party.name} me={party.me} size="xl" />
      <Text weight={700} size={13} numberOfLines={1}>
        {party.me ? 'You' : firstName(party.name)}
      </Text>
    </View>
  )
}

/** The dashed line between the two people, flowing toward who gets paid. */
function Flow() {
  const colors = useColors()
  const reduce = useReduceMotion()
  const shift = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (reduce) return
    const loop = Animated.loop(Animated.timing(shift, { toValue: 1, duration: 800, easing: Easing.linear, useNativeDriver: true }))
    loop.start()
    return () => loop.stop()
  }, [reduce, shift])
  return (
    <View style={styles.flowLine}>
      <Animated.View
        style={[
          styles.dashes,
          { transform: [{ translateX: shift.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] },
        ]}
      >
        {Array.from({ length: 10 }, (_, i) => (
          <View key={i} style={[styles.dash, { backgroundColor: colors.accent }]} />
        ))}
      </Animated.View>
    </View>
  )
}

function MemberPicker({ label, members, value, onPick }: { label: string; members: Array<Party>; value: string; onPick: (id: string) => void }) {
  return (
    <View style={styles.pickerRow}>
      <Label style={{ width: 40, paddingLeft: 20 }}>{label}</Label>
      <ScrollView horizontal style={{ flexGrow: 0 }} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingLeft: 12, paddingRight: 20 }}>
        {members.map((m) => (
          <Chip
            key={m.id}
            tone={m.id === value ? 'on' : 'neutral'}
            selected={m.id === value}
            leading={<Avatar id={m.id} name={m.name} me={m.me} size="xs" />}
            onPress={() => onPick(m.id)}
          >
            {m.me ? 'You' : firstName(m.name)}
          </Chip>
        ))}
      </ScrollView>
    </View>
  )
}

function Loading() {
  return (
    <View style={{ padding: 40 }}>
      <Sub align="center">Loading…</Sub>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8 },
  flow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 22 },
  party: { alignItems: 'center', gap: 6, width: 72 },
  arrow: { width: 96, alignItems: 'center', gap: 6, marginBottom: 4 },
  swap: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  flowLine: { width: 96, height: 3, overflow: 'hidden' },
  dashes: { flexDirection: 'row', gap: 6, width: 120 },
  dash: { width: 6, height: 3, borderRadius: 2 },
  pickerRow: { flexDirection: 'row', alignItems: 'center' },
  amount: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 18, paddingHorizontal: 20 },
  amountEdit: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  amountInput: { minWidth: 120, fontFamily: fonts.display[800], fontSize: 54, padding: 0, textAlign: 'center' },
  modes: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 12 },
  details: { marginTop: 22, marginHorizontal: 16, borderRadius: 22 },
  detailRow: { paddingVertical: 10 },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, minHeight: 56, borderTopWidth: 1 },
  noteInput: { flex: 1, fontFamily: fonts.sans[600], fontSize: 15 },
  after: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, marginHorizontal: 20 },
  upi: { marginTop: 18, marginHorizontal: 16, padding: 12, paddingLeft: 16, borderRadius: 22, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', gap: 12 },
  slide: { marginTop: 16, paddingHorizontal: 16 },
  foot: { paddingHorizontal: 24, paddingTop: 10 },
})
