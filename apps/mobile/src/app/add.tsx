import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { api } from '@settlr/backend/convex/_generated/api'
import type { Id } from '@settlr/backend/convex/_generated/dataModel'
import { categoryLabel } from '@settlr/shared/format'
import { CATEGORIES, CURRENCIES, type Category, type Currency } from '@settlr/shared/schemas'
import { useMutation, useQuery } from 'convex/react'
import { useLocalSearchParams, useRouter, type Href } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Button } from '@/components/button'
import { Checkbox, Chip, Segmented, StepButton } from '@/components/controls'
import { CATEGORY_ICON, Icons } from '@/components/icons'
import { ripple } from '@/components/ripple'
import { Keypad } from '@/components/keypad'
import { Sheet, SheetPage, SheetTitle, toast } from '@/components/overlay'
import { TopBar } from '@/components/screen'
import { Row } from '@/components/surfaces'
import { Label, Sub, Text } from '@/components/text'
import { Avatar, Badge, CategoryTile, GroupTile, Tile } from '@/components/tiles'
import { errorText } from '@/lib/actions'
import { guessCategory, CATEGORY_HUE } from '@/lib/category'
import {
  defaultGroupSplit,
  effectFor,
  friendArgs,
  friendEffect,
  friendOwed,
  friendSplitProblem,
  groupArgs,
  groupOwed,
  groupSplitLabel,
  groupSplitProblem,
  seedInputs,
  splitFromSaved,
  type FriendSplit,
  type GroupMode,
  type GroupSplit,
} from '@/lib/expense-form'
import { currencySymbol, dateChip, firstName, localIsoDate, money, signedMoney } from '@/lib/format'
import { thud } from '@/lib/haptics'
import { amountCents, centsToAmount, displayAmount, pressKey, type Key } from '@/lib/keypad'
import { setPrefs, usePrefs, type Target } from '@/lib/prefs'
import { fonts, useColors } from '@/theme'

type Params = {
  /** Where to add it (from a group's or friend's page). */
  kind?: 'personal' | 'friend' | 'group'
  id?: string
  /** Editing: the expense's id, and its group or friend. */
  edit?: string
  parent?: string
  date?: string
}

/** Add (or edit) an expense: amount first on a big keypad, everything else a chip. */
export default function AddExpenseScreen() {
  return (
    <SheetPage>
      <AddExpenseScreenForm />
    </SheetPage>
  )
}

function AddExpenseScreenForm() {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const prefs = usePrefs()
  const params = useLocalSearchParams<Params>()
  const { height: screen } = useWindowDimensions()
  const today = localIsoDate()
  const editing = Boolean(params.edit)

  const groups = useQuery(api.groups.list)
  const friends = useQuery(api.friends.list)

  const initialTarget: Target =
    params.kind === 'group' && (params.id || params.parent)
      ? { kind: 'group', id: (params.id && !editing ? params.id : params.parent)! }
      : params.kind === 'friend' && (params.id || params.parent)
        ? { kind: 'friend', id: (params.id && !editing ? params.id : params.parent)! }
        : params.kind === 'personal'
          ? { kind: 'personal' }
          : prefs.lastTarget
  const [target, setTarget] = useState<Target>(initialTarget)

  // A remembered group or friend that's gone falls back to Personal.
  useEffect(() => {
    if (editing || !groups || !friends) return
    if (target.kind === 'group' && !groups.some((g) => g.id === target.id && !g.archived)) setTarget({ kind: 'personal' })
    if (target.kind === 'friend' && !friends.some((f) => f.id === target.id)) setTarget({ kind: 'personal' })
  }, [editing, friends, groups, target])

  const group = useQuery(api.groups.get, target.kind === 'group' ? { groupId: target.id } : 'skip')
  const friend = useQuery(api.friends.get, target.kind === 'friend' ? { friendId: target.id } : 'skip')

  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<Category>('other')
  const [categoryPicked, setCategoryPicked] = useState(false)
  const [date, setDate] = useState(today)
  const [currency, setCurrency] = useState<Currency>(prefs.currency)
  const [groupSplit, setGroupSplit] = useState<GroupSplit | null>(null)
  const [friendSplit, setFriendSplit] = useState<FriendSplit>({ paidBy: 'me', split: 'equal', owedCents: 0 })
  const [sheet, setSheet] = useState<'where' | 'split' | 'category' | 'currency' | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cents = amountCents(amount)
  const order = useMemo(() => group?.members.map((m) => m.id) ?? [], [group])
  const meId = group?.meMemberId ?? ''

  // A group's split starts as everyone, equally, paid by you.
  useEffect(() => {
    if (!group) return
    setGroupSplit((current) =>
      current && current.included.every((id) => order.includes(id)) && order.includes(current.payer)
        ? current
        : defaultGroupSplit(order, group.meMemberId),
    )
  }, [group, order])

  // The currency follows the group; a friend starts on their open balance's.
  useEffect(() => {
    if (group) setCurrency(group.currency)
  }, [group])
  useEffect(() => {
    if (!friend || editing) return
    const open = Object.entries(friend.balances).find(([, c]) => c !== 0)
    if (open) setCurrency(open[0] as Currency)
  }, [editing, friend])

  // The description suggests a category until one is picked by hand.
  useEffect(() => {
    if (categoryPicked) return
    setCategory(guessCategory(description) ?? 'other')
  }, [categoryPicked, description])

  const existing = useEditing(params, editing)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    if (!existing || loaded) return
    if (existing.kind === 'group' && !group) return
    setAmount(centsToAmount(existing.amountCents))
    setDescription(existing.description)
    setCategory(existing.category)
    setCategoryPicked(true)
    setDate(existing.date)
    setCurrency(existing.currency ?? group?.currency ?? prefs.currency)
    if (existing.kind === 'group' && group) setGroupSplit(splitFromSaved(existing.saved, order))
    if (existing.kind === 'friend') setFriendSplit(existing.split)
    setLoaded(true)
  }, [existing, group, loaded, order, prefs.currency])

  const addPersonal = useMutation(api.personal.add)
  const updatePersonal = useMutation(api.personal.update)
  const addFriend = useMutation(api.friends.addExpense)
  const updateFriend = useMutation(api.friends.updateExpense)
  const addGroup = useMutation(api.groups.addExpense)
  const updateGroup = useMutation(api.groups.updateExpense)

  const targetName =
    target.kind === 'personal'
      ? 'Personal'
      : target.kind === 'group'
        ? (group?.name ?? groups?.find((g) => g.id === target.id)?.name ?? 'Group')
        : (friend?.name ?? friends?.find((f) => f.id === target.id)?.name ?? 'Friend')

  const problem =
    target.kind === 'group' && groupSplit
      ? groupSplitProblem(groupSplit, cents, order)
      : target.kind === 'friend'
        ? friendSplitProblem(friendSplit, cents)
        : null

  // The line under the amount: what this means for you.
  let shareLine = ''
  let shareColor: string = colors.muted
  if (cents > 0 && target.kind === 'group' && groupSplit && group) {
    const owed = groupOwed(groupSplit, cents, order)
    const effect = effectFor(meId, groupSplit.payer, cents, owed)
    if (groupSplit.mode === 'equal' && groupSplit.included.length > 0) {
      const each = Math.floor(cents / groupSplit.included.length)
      shareLine = `${money(each, currency)} each · ${groupSplit.included.length} people`
    }
    if (effect !== 0) {
      shareLine = `${shareLine ? `${shareLine} · ` : ''}${effect > 0 ? 'you lend' : 'you borrow'} ${money(effect, currency)}`
      shareColor = effect > 0 ? colors.owed : colors.owe
    }
  } else if (cents > 0 && target.kind === 'friend' && friend) {
    const effect = friendEffect(friendSplit, cents)
    const name = firstName(friend.name)
    shareLine = effect > 0 ? `${name} owes you ${money(effect, currency)}` : `You owe ${name} ${money(effect, currency)}`
    shareColor = effect > 0 ? colors.owed : colors.owe
  } else if (target.kind === 'personal') {
    shareLine = 'Just you · counts toward your budget'
  }

  const splitChip =
    target.kind === 'group' && groupSplit
      ? groupSplitLabel(groupSplit, cents, order)
      : target.kind === 'friend'
        ? { equal: 'Split equally', full: 'Owed in full', exact: 'Exact amount' }[friendSplit.split]
        : ''
  const payerName =
    target.kind === 'group' && groupSplit
      ? groupSplit.payer === meId
        ? 'you'
        : firstName(group?.members.find((m) => m.id === groupSplit.payer)?.name ?? '')
      : friendSplit.paidBy === 'me'
        ? 'you'
        : firstName(friend?.name ?? '')

  function pickDate() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: new Date(`${date}T12:00:00`),
        mode: 'date',
        maximumDate: new Date(),
        onChange: (event, value) => {
          if (event.type === 'set' && value) setDate(localIsoDate(value))
        },
      })
    } else {
      setShowIosDate((v) => !v)
    }
  }
  const [showIosDate, setShowIosDate] = useState(false)

  async function submit() {
    setError(null)
    const desc = description.trim()
    if (cents <= 0) return setError('Type an amount first.')
    if (!desc) return setError('Say what it was for.')
    if (problem) return setError(problem)
    const common = { description: desc, amountCents: cents, category, date }
    setPending(true)
    try {
      if (target.kind === 'personal') {
        if (editing && existing?.kind === 'personal') {
          await updatePersonal({ expenseId: existing.id as Id<'personalExpenses'>, ...common, currency, receiptId: existing.receiptId as Id<'receipts'> | null })
        } else {
          await addPersonal({ ...common, currency })
        }
      } else if (target.kind === 'friend') {
        const args = friendArgs({ ...common, currency }, friendSplit)
        if (editing && existing?.kind === 'friend') {
          await updateFriend({ entryId: existing.id as Id<'friendEntries'>, ...args, receiptId: existing.receiptId as Id<'receipts'> | null })
        } else {
          await addFriend({ friendId: target.id as Id<'friends'>, ...args })
        }
      } else if (groupSplit) {
        const args = groupArgs(common, groupSplit, order)
        if (editing && existing?.kind === 'group') {
          await updateGroup({ expenseId: existing.id as Id<'groupExpenses'>, ...args, receiptId: existing.receiptId as Id<'receipts'> | null })
        } else {
          await addGroup({ groupId: target.id as Id<'groups'>, ...args })
        }
      }
      thud()
      if (!editing) setPrefs({ lastTarget: target })
      const where = target.kind === 'personal' ? 'your spending' : targetName
      const href: Href = target.kind === 'group' ? `/groups/${target.id}` : target.kind === 'friend' ? `/friends/${target.id}` : '/spending'
      router.back()
      toast(editing ? 'Expense updated' : `Expense added to ${where}`, editing ? {} : { action: { label: 'View', onPress: () => router.push(href) } })
    } catch (err) {
      setError(errorText(err))
    } finally {
      setPending(false)
    }
  }

  const keyHeight = screen < 720 ? 46 : screen < 800 ? 52 : 58
  const amountSize = amount.length > 9 ? 52 : amount.length > 6 ? 62 : 76
  const indian = currency === 'INR'

  return (
    <View style={[styles.flex, { backgroundColor: colors.surface, paddingTop: insets.top + 4, paddingBottom: insets.bottom + 14 }]}>
      <TopBar
        close
        title={editing ? 'Edit expense' : 'New expense'}
        actions={
          editing ? null : (
            <Chip tone="accent" icon={Icons.spark} height={40} onPress={() => router.replace('/assistant')} style={{ marginRight: 6 }}>
              Say it
            </Chip>
          )
        }
      />

      <View style={styles.where}>
        <Sub weight={600}>In</Sub>
        <Chip
          height={40}
          leading={
            target.kind === 'group' ? (
              <GroupTile id={target.id} name={targetName} size={28} radius={10} />
            ) : target.kind === 'friend' ? (
              <Avatar id={target.id} name={targetName} size="xs" />
            ) : (
              <Tile hue="gray" size={28} radius={10} icon={Icons.wallet} iconSize={15} />
            )
          }
          iconRight={editing ? undefined : Icons.chevD}
          onPress={editing ? undefined : () => setSheet('where')}
          accessibilityLabel={`Where it goes: ${targetName}`}
        >
          {targetName}
        </Chip>
      </View>

      <View style={styles.amountArea}>
        <View style={styles.amountRow} accessibilityLabel={`Amount ${money(cents, currency)}`}>
          <Text display weight={700} size={34} lineHeight={50} color="faint">
            {currencySymbol(currency)}
          </Text>
          <Text display weight={800} size={amountSize} lineHeight={amountSize + 4} tracking={-0.05} tabular numberOfLines={1} adjustsFontSizeToFit>
            {displayAmount(amount, indian)}
          </Text>
          <View style={[styles.caret, { backgroundColor: colors.accent, height: amountSize * 0.7 }]} />
        </View>
        {shareLine ? (
          <Text weight={700} size={14} tabular color={shareColor} align="center" numberOfLines={1}>
            {shareLine}
          </Text>
        ) : null}
      </View>

      <View style={styles.details}>
        <View style={[styles.descRow, { backgroundColor: colors.surface2 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Category: ${categoryLabel(category)}`}
            onPress={() => setSheet('category')}
            android_ripple={ripple(colors.text, { borderless: true, radius: 26 })}
          >
            <CategoryTile category={category} />
          </Pressable>
          <TextInput
            accessibilityLabel="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="What was it for?"
            placeholderTextColor={colors.faint}
            maxLength={80}
            selectionColor={colors.accent}
            returnKeyType="done"
            style={[styles.descInput, { color: colors.text }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change category"
            onPress={() => setSheet('category')}
            android_ripple={ripple(colors.text, { borderless: true, radius: 44 })}
            hitSlop={6}
          >
            <Badge size="lg" bg={colors.surface} fg={colors.text} icon={categoryPicked ? undefined : Icons.spark}>
              {categoryLabel(category)}
            </Badge>
          </Pressable>
        </View>
        <ScrollView horizontal style={{ flexGrow: 0 }} showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.chips}>
          <Chip icon={Icons.cal} onPress={pickDate} accessibilityLabel={`Date: ${dateChip(date, today)}`}>
            {dateChip(date, today)}
          </Chip>
          {target.kind !== 'personal' ? (
            <>
              <Chip
                leading={
                  target.kind === 'group' && groupSplit ? (
                    <Avatar id={groupSplit.payer} name={payerName === 'you' ? 'You' : payerName} me={groupSplit.payer === meId} size="xs" />
                  ) : (
                    <Avatar id={friend?.id} name={payerName === 'you' ? 'You' : payerName} me={friendSplit.paidBy === 'me'} size="xs" />
                  )
                }
                iconRight={Icons.chevD}
                onPress={() => setSheet('split')}
              >
                {`Paid by ${payerName}`}
              </Chip>
              <Chip tone="accent" icon={Icons.split} iconRight={Icons.chevD} onPress={() => setSheet('split')}>
                {splitChip}
              </Chip>
            </>
          ) : null}
          {target.kind !== 'group' ? (
            <Chip iconRight={Icons.chevD} onPress={() => setSheet('currency')} accessibilityLabel={`Currency: ${currency}`}>
              {`${currencySymbol(currency)} ${currency}`}
            </Chip>
          ) : (
            <Chip accessibilityLabel={`Currency: ${currency}, the group's`}>{`${currencySymbol(currency)} ${currency}`}</Chip>
          )}
        </ScrollView>
        {showIosDate ? (
          <DateTimePicker value={new Date(`${date}T12:00:00`)} mode="date" maximumDate={new Date()} onChange={(_, v) => v && setDate(localIsoDate(v))} />
        ) : null}
      </View>

      <View style={styles.keypad}>
        <Keypad onKey={(key: Key) => setAmount((a) => pressKey(a, key))} height={keyHeight} />
      </View>

      {error ? (
        <Text weight={700} size={13.5} color="owe" align="center" style={{ paddingHorizontal: 16, paddingTop: 10 }} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <View style={styles.submit}>
        <Button wide size="xl" icon={Icons.check} onPress={submit} loading={pending} haptic={false}>
          {editing ? 'Save changes' : 'Add expense'}
        </Button>
      </View>

      <WhereSheet
        open={sheet === 'where'}
        onClose={() => setSheet(null)}
        target={target}
        groups={(groups ?? []).filter((g) => !g.archived)}
        friends={friends ?? []}
        onPick={(t) => {
          setTarget(t)
          setGroupSplit(null)
          setFriendSplit({ paidBy: 'me', split: 'equal', owedCents: 0 })
          if (t.kind !== 'group') setCurrency(prefs.currency)
          setSheet(null)
        }}
        onNew={() => {
          setSheet(null)
          router.push('/friends/new')
        }}
      />
      {target.kind === 'group' && group && groupSplit ? (
        <GroupSplitSheet
          open={sheet === 'split'}
          onClose={() => setSheet(null)}
          members={group.members.map((m) => ({ id: m.id, name: m.name, netCents: m.netCents }))}
          meId={meId}
          groupName={group.name}
          currency={currency}
          amountCents={cents}
          description={description}
          split={groupSplit}
          onChange={setGroupSplit}
          editing={editing && existing?.kind === 'group' ? existing : null}
        />
      ) : null}
      {target.kind === 'friend' && friend ? (
        <FriendSplitSheet
          open={sheet === 'split'}
          onClose={() => setSheet(null)}
          friend={{ id: friend.id, name: friend.name }}
          currency={currency}
          amountCents={cents}
          split={friendSplit}
          onChange={setFriendSplit}
        />
      ) : null}
      <Sheet open={sheet === 'category'} onClose={() => setSheet(null)} label="Category">
        <SheetTitle>Category</SheetTitle>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c}
              accessibilityRole="button"
              accessibilityState={{ selected: c === category }}
              onPress={() => {
                setCategory(c)
                setCategoryPicked(true)
                setSheet(null)
              }}
              android_ripple={ripple(colors.accentInk)}
              style={[styles.categoryCell, c === category && { backgroundColor: colors.accentSoft }]}
            >
              <Tile hue={CATEGORY_HUE[c]} size={50} radius={17} icon={Icons[CATEGORY_ICON[c]]} iconSize={24} />
              <Text weight={700} size={13}>
                {categoryLabel(c)}
              </Text>
            </Pressable>
          ))}
        </View>
      </Sheet>
      <Sheet open={sheet === 'currency'} onClose={() => setSheet(null)} label="Currency">
        <SheetTitle>Currency</SheetTitle>
        <View style={{ paddingVertical: 8 }}>
          {CURRENCIES.map((c) => (
            <Row
              key={c}
              minHeight={56}
              leading={<Tile size={40} radius={13} letter={currencySymbol(c)} />}
              title={c}
              end={c === currency ? <Icons.check color={colors.accent} size={20} /> : null}
              onPress={() => {
                setCurrency(c)
                setSheet(null)
              }}
            />
          ))}
        </View>
      </Sheet>
    </View>
  )
}

type Existing =
  | { kind: 'personal'; id: string; amountCents: number; description: string; category: Category; date: string; currency: Currency; receiptId: string | null }
  | { kind: 'friend'; id: string; amountCents: number; description: string; category: Category; date: string; currency: Currency; receiptId: string | null; split: FriendSplit }
  | {
      kind: 'group'
      id: string
      amountCents: number
      description: string
      category: Category
      date: string
      currency?: undefined
      receiptId: string | null
      saved: Parameters<typeof splitFromSaved>[0]
      owed: Record<string, number>
      paidBy: string
    }

/** The expense being edited, read from wherever it lives. */
function useEditing(params: Params, editing: boolean): Existing | null {
  const month = (params.date ?? '').slice(0, 7)
  const personal = useQuery(api.personal.month, editing && params.kind === 'personal' && month ? { month } : 'skip')
  const entries = useQuery(
    api.friends.entries,
    editing && params.kind === 'friend' && params.parent
      ? { friendId: params.parent, q: '', category: 'all', paidBy: '', sort: 'date', order: 'desc', limit: 500 }
      : 'skip',
  )
  const groupExpense = useQuery(
    api.groups.expense,
    editing && params.kind === 'group' && params.parent && params.edit ? { groupId: params.parent, expenseId: params.edit } : 'skip',
  )
  const groupList = useQuery(
    api.groups.expenses,
    editing && params.kind === 'group' && params.parent
      ? { groupId: params.parent, q: '', category: 'all', paidBy: '', sort: 'date', order: 'desc', limit: 500 }
      : 'skip',
  )
  if (!editing) return null
  if (params.kind === 'personal') {
    const e = personal?.items.find((i) => i.id === params.edit)
    return e ? { kind: 'personal', ...e } : null
  }
  if (params.kind === 'friend') {
    const e = entries?.items.find((i) => i.id === params.edit)
    if (!e || e.kind !== 'expense') return null
    return {
      kind: 'friend',
      id: e.id,
      amountCents: e.amountCents,
      description: e.description,
      category: e.category,
      date: e.date,
      currency: e.currency,
      receiptId: e.receiptId ?? null,
      split: { paidBy: e.paidBy, split: e.split, owedCents: e.owedCents ?? 0 },
    }
  }
  if (params.kind === 'group' && groupExpense) {
    const owed = groupList?.items.find((i) => i.id === params.edit)?.owed ?? {}
    return {
      kind: 'group',
      id: groupExpense.id,
      amountCents: groupExpense.amountCents,
      description: groupExpense.description,
      category: groupExpense.category,
      date: groupExpense.date,
      receiptId: groupExpense.receiptId,
      saved: {
        paidBy: groupExpense.paidBy,
        splitAmong: groupExpense.splitAmong,
        split: groupExpense.split ? { mode: groupExpense.split.mode, inputs: groupExpense.split.inputs, owed: groupExpense.split.owed } : null,
      },
      owed,
      paidBy: groupExpense.paidBy,
    }
  }
  return null
}

type GroupItem = { id: string; name: string; currency: Currency; memberCount: number }
type FriendItem = { id: string; name: string; balances: Record<string, number> }

/** "Where does it go?": just you, a group, or a friend. */
function WhereSheet({
  open,
  onClose,
  target,
  groups,
  friends,
  onPick,
  onNew,
}: {
  open: boolean
  onClose: () => void
  target: Target
  groups: Array<GroupItem>
  friends: Array<FriendItem>
  onPick: (target: Target) => void
  onNew: () => void
}) {
  const colors = useColors()
  const [q, setQ] = useState('')
  const match = (name: string) => name.toLowerCase().includes(q.trim().toLowerCase())
  const on = (t: Target) => t.kind === target.kind && (t.kind === 'personal' || (target.kind !== 'personal' && t.id === target.id))
  const picked = { backgroundColor: colors.accentSoft, marginHorizontal: 8, borderRadius: 18, paddingLeft: 8, paddingRight: 10 }
  return (
    <Sheet open={open} onClose={onClose} height={0.84} label="Where does it go?">
      <SheetTitle>Where does it go?</SheetTitle>
      <View style={[styles.search, { backgroundColor: colors.surface2 }]}>
        <Icons.search color={colors.faint} size={18} />
        <TextInput
          accessibilityLabel="Search groups and friends"
          value={q}
          onChangeText={setQ}
          placeholder="Search groups and friends"
          placeholderTextColor={colors.faint}
          selectionColor={colors.accent}
          style={[styles.searchInput, { color: colors.text }]}
        />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 12 }}>
        {match('personal') || !q ? (
          <>
            <Label style={styles.groupLabel}>Just you</Label>
            <Row
              style={on({ kind: 'personal' }) ? picked : undefined}
              leading={<Tile hue="gray" icon={Icons.wallet} />}
              title="Personal"
              subtitle="Only you · any currency"
              end={on({ kind: 'personal' }) ? <Checkbox checked /> : null}
              onPress={() => onPick({ kind: 'personal' })}
            />
          </>
        ) : null}
        {groups.filter((g) => match(g.name)).length > 0 ? <Label style={styles.groupLabel}>Groups</Label> : null}
        {groups
          .filter((g) => match(g.name))
          .map((g) => {
            const t: Target = { kind: 'group', id: g.id }
            return (
              <Row
                key={g.id}
                style={on(t) ? picked : undefined}
                leading={<GroupTile id={g.id} name={g.name} />}
                title={g.name}
                subtitle={`${g.memberCount} people · ${g.currency}`}
                end={on(t) ? <Checkbox checked /> : null}
                onPress={() => onPick(t)}
              />
            )
          })}
        {friends.filter((f) => match(f.name)).length > 0 ? <Label style={styles.groupLabel}>Friends</Label> : null}
        {friends
          .filter((f) => match(f.name))
          .map((f) => {
            const t: Target = { kind: 'friend', id: f.id }
            return (
              <Row
                key={f.id}
                style={on(t) ? picked : undefined}
                leading={<Avatar id={f.id} name={f.name} />}
                title={f.name}
                subtitle="Split equally or owed in full"
                end={on(t) ? <Checkbox checked /> : null}
                onPress={() => onPick(t)}
              />
            )
          })}
        <Row
          leading={<Tile bg={colors.surface2} fg={colors.accentInk} icon={Icons.userPlus} />}
          title="Someone new"
          titleColor={colors.accentInk}
          subtitle="Add a friend first"
          onPress={onNew}
        />
      </ScrollView>
    </Sheet>
  )
}

const MODES: Array<{ value: GroupMode; label: string; hint: string }> = [
  { value: 'equal', label: 'Equally', hint: 'Everyone ticked pays the same.' },
  { value: 'exact', label: 'Amounts', hint: 'Type what each person owes.' },
  { value: 'percent', label: '%', hint: 'Percentages that add up to 100.' },
  { value: 'shares', label: 'Shares', hint: 'e.g. 2 for a couple, 1 for one person.' },
]

/** "Who paid, who shares" for a group: the payer, the mode and each share. */
function GroupSplitSheet({
  open,
  onClose,
  members,
  meId,
  groupName,
  currency,
  amountCents,
  description,
  split,
  onChange,
  editing,
}: {
  open: boolean
  onClose: () => void
  members: Array<{ id: string; name: string; netCents: number }>
  meId: string
  groupName: string
  currency: Currency
  amountCents: number
  description: string
  split: GroupSplit
  onChange: (split: GroupSplit) => void
  editing: { owed: Record<string, number>; paidBy: string; amountCents: number } | null
}) {
  const colors = useColors()
  const order = members.map((m) => m.id)
  const owed = groupOwed(split, amountCents, order)
  const problem = groupSplitProblem(split, amountCents, order)
  const mode = MODES.find((m) => m.value === split.mode)!
  const me = members.find((m) => m.id === meId)
  // Your balance before this expense (without its old version when editing).
  const before =
    (me?.netCents ?? 0) -
    (editing ? (editing.paidBy === meId ? editing.amountCents : 0) - (editing.owed[meId] ?? 0) : 0)
  const after = before + effectFor(meId, split.payer, amountCents, owed)

  function setMode(next: GroupMode) {
    onChange({ ...split, mode: next, inputs: next === 'equal' ? {} : seedInputs(next, order, amountCents) })
  }
  function bump(id: string, by: number, min: number, max: number) {
    const value = Math.min(max, Math.max(min, (split.inputs[id] ?? 0) + by))
    onChange({ ...split, inputs: { ...split.inputs, [id]: value } })
  }
  const name = (id: string) => (id === meId ? 'You' : (members.find((m) => m.id === id)?.name ?? ''))

  return (
    <Sheet open={open} onClose={onClose} height={0.9} label="Who paid, who shares">
      <SheetTitle kicker={`${description.trim() || 'This expense'} · ${money(amountCents, currency)}`}>Who paid, who shares</SheetTitle>
      <Text weight={700} size={13} color="muted" style={styles.flabel}>
        Paid by
      </Text>
      <ScrollView horizontal style={{ flexGrow: 0 }} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.payers}>
        {members.map((m) => {
          const on = split.payer === m.id
          return (
            <Pressable
              key={m.id}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`Paid by ${name(m.id)}`}
              onPress={() => onChange({ ...split, payer: m.id })}
              android_ripple={ripple(colors.accentInk, { borderless: true, radius: 34 })}
              style={styles.payer}
            >
              <View style={[styles.payerRing, on && { borderColor: colors.accent }]}>
                <Avatar id={m.id} name={name(m.id)} me={m.id === meId} size="xl" style={{ width: 50, height: 50 }} />
              </View>
              <Text weight={700} size={12.5} numberOfLines={1}>
                {m.id === meId ? 'You' : firstName(m.name)}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <Segmented value={split.mode} options={MODES} onChange={setMode} height={46} label="How to split" />
        <View style={styles.hintRow}>
          <Sub style={styles.flex}>{mode.hint}</Sub>
          <Badge tone="accent">{`${owed.size} ${owed.size === 1 ? 'person' : 'people'}`}</Badge>
        </View>
      </View>
      <ScrollView style={styles.flex} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 4 }}>
        {members.map((m) => {
          const share = owed.get(m.id) ?? 0
          if (split.mode === 'equal') {
            const on = split.included.includes(m.id)
            return (
              <Row
                key={m.id}
                minHeight={58}
                leading={<Avatar id={m.id} name={name(m.id)} me={m.id === meId} size="sm" />}
                title={name(m.id)}
                titleSize={15}
                end={
                  <View style={styles.rowEnd}>
                    <Text weight={800} size={15.5} tabular style={{ opacity: on ? 1 : 0.35 }}>
                      {money(share, currency)}
                    </Text>
                    <Checkbox checked={on} />
                  </View>
                }
                onPress={() =>
                  onChange({
                    ...split,
                    included: on ? split.included.filter((id) => id !== m.id) : order.filter((id) => id === m.id || split.included.includes(id)),
                  })
                }
                accessibilityLabel={`${name(m.id)}, ${on ? 'sharing' : 'not sharing'}`}
              />
            )
          }
          if (split.mode === 'exact') {
            return (
              <Row
                key={m.id}
                minHeight={58}
                leading={<Avatar id={m.id} name={name(m.id)} me={m.id === meId} size="sm" />}
                title={name(m.id)}
                titleSize={15}
                end={
                  <AmountBox
                    currency={currency}
                    cents={split.inputs[m.id] ?? 0}
                    label={`Amount for ${name(m.id)}`}
                    onChange={(c) => onChange({ ...split, inputs: { ...split.inputs, [m.id]: c } })}
                  />
                }
              />
            )
          }
          const isPercent = split.mode === 'percent'
          const value = split.inputs[m.id] ?? 0
          return (
            <Row
              key={m.id}
              minHeight={58}
              leading={<Avatar id={m.id} name={name(m.id)} me={m.id === meId} size="sm" />}
              title={name(m.id)}
              titleSize={15}
              subtitle={
                <Text weight={700} size={13} tabular color="muted">
                  {money(share, currency)}
                </Text>
              }
              end={
                <View style={styles.rowEnd}>
                  <StepButton icon={Icons.minus} label={`Less for ${name(m.id)}`} onPress={() => bump(m.id, isPercent ? -500 : -1, 0, isPercent ? 10_000 : 99)} />
                  <Text weight={800} size={16} tabular align="center" style={{ width: 46 }}>
                    {isPercent ? `${value / 100}%` : value}
                  </Text>
                  <StepButton icon={Icons.plus} label={`More for ${name(m.id)}`} onPress={() => bump(m.id, isPercent ? 500 : 1, 0, isPercent ? 10_000 : 99)} />
                </View>
              }
            />
          )
        })}
      </ScrollView>
      <View style={[styles.preview, { backgroundColor: colors.surface2 }]}>
        <View style={styles.flex}>
          <Label>Your balance in {groupName}</Label>
          <View style={[styles.rowEnd, { marginTop: 3 }]}>
            <Text weight={800} size={16} tabular color="muted">
              {signedMoney(before, currency)}
            </Text>
            <Icons.arrowR color={colors.faint} size={15} />
            <Text weight={800} size={16} tabular color={after > 0 ? colors.owed : after < 0 ? colors.owe : colors.text}>
              {signedMoney(after, currency)}
            </Text>
          </View>
        </View>
        <Text weight={700} size={12} lineHeight={16} align="right" color={problem ? colors.owe : colors.muted} style={{ width: 140 }}>
          {problem ?? (after > 0 ? 'you’re owed after this' : after < 0 ? 'you owe after this' : 'all square after this')}
        </Text>
      </View>
      <View style={styles.sheetActions}>
        <Button wide onPress={onClose} disabled={Boolean(problem)} style={{ height: 56 }}>
          Done
        </Button>
      </View>
    </Sheet>
  )
}

/** A friend expense: who paid, and equally, in full or an exact amount. */
function FriendSplitSheet({
  open,
  onClose,
  friend,
  currency,
  amountCents,
  split,
  onChange,
}: {
  open: boolean
  onClose: () => void
  friend: { id: string; name: string }
  currency: Currency
  amountCents: number
  split: FriendSplit
  onChange: (split: FriendSplit) => void
}) {
  const colors = useColors()
  const first = firstName(friend.name)
  const owed = friendOwed(split, amountCents)
  const effect = friendEffect(split, amountCents)
  const problem = friendSplitProblem(split, amountCents)
  const other = split.paidBy === 'me' ? first : 'You'
  return (
    <Sheet open={open} onClose={onClose} label="Who paid, who owes">
      <SheetTitle kicker={money(amountCents, currency)}>Who paid, who owes</SheetTitle>
      <Text weight={700} size={13} color="muted" style={styles.flabel}>
        Paid by
      </Text>
      <View style={[styles.payers, { paddingHorizontal: 20 }]}>
        {(['me', 'friend'] as const).map((who) => {
          const on = split.paidBy === who
          return (
            <Pressable
              key={who}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`Paid by ${who === 'me' ? 'you' : first}`}
              onPress={() => onChange({ ...split, paidBy: who })}
              android_ripple={ripple(colors.accentInk, { borderless: true, radius: 34 })}
              style={styles.payer}
            >
              <View style={[styles.payerRing, on && { borderColor: colors.accent }]}>
                <Avatar id={who === 'me' ? undefined : friend.id} name={who === 'me' ? 'You' : friend.name} me={who === 'me'} size="xl" style={{ width: 50, height: 50 }} />
              </View>
              <Text weight={700} size={12.5}>
                {who === 'me' ? 'You' : first}
              </Text>
            </Pressable>
          )
        })}
      </View>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 12 }}>
        <Segmented
          value={split.split}
          onChange={(s) => onChange({ ...split, split: s, owedCents: s === 'exact' && !split.owedCents ? Math.floor(amountCents / 2) : split.owedCents })}
          options={[
            { value: 'equal', label: 'Equally' },
            { value: 'full', label: 'In full' },
            { value: 'exact', label: 'Amount' },
          ]}
          label="How to split"
        />
        {split.split === 'exact' ? (
          <View style={styles.exactRow}>
            <Text weight={700} size={15} style={styles.flex}>
              {other} {other === 'You' ? 'owe' : 'owes'}
            </Text>
            <AmountBox currency={currency} cents={split.owedCents} label={`What ${other} owes`} onChange={(c) => onChange({ ...split, owedCents: c })} />
          </View>
        ) : null}
      </View>
      <View style={[styles.preview, { backgroundColor: colors.surface2, marginTop: 16 }]}>
        <View style={styles.flex}>
          <Label>Afterwards for this expense</Label>
          <Text weight={800} size={16} tabular color={problem ? colors.owe : effect > 0 ? colors.owed : colors.owe} style={{ marginTop: 3 }}>
            {problem ?? (effect > 0 ? `${first} owes you ${money(owed, currency)}` : `You owe ${first} ${money(owed, currency)}`)}
          </Text>
        </View>
      </View>
      <View style={styles.sheetActions}>
        <Button wide onPress={onClose} disabled={Boolean(problem)} style={{ height: 56 }}>
          Done
        </Button>
      </View>
    </Sheet>
  )
}

/** A small money field: "₹ 1,240". */
function AmountBox({ currency, cents, onChange, label }: { currency: Currency; cents: number; onChange: (cents: number) => void; label: string }) {
  const colors = useColors()
  const [text, setText] = useState(cents ? centsToAmount(cents) : '')
  useEffect(() => {
    if (amountCents(text) !== cents) setText(cents ? centsToAmount(cents) : '')
    // Only when the value changes from outside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cents])
  return (
    <View style={[styles.amountBox, { backgroundColor: colors.surface2 }]}>
      <Text weight={700} size={16} color="faint">
        {currencySymbol(currency)}
      </Text>
      <TextInput
        accessibilityLabel={label}
        value={text}
        onChangeText={(t) => {
          const clean = t.replace(/[^0-9.]/g, '')
          setText(clean)
          onChange(amountCents(clean))
        }}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={colors.faint}
        selectionColor={colors.accent}
        style={[styles.amountBoxInput, { color: colors.text }]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  where: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 2 },
  amountArea: { flex: 1, minHeight: 96, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 16 },
  amountRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, maxWidth: '100%' },
  caret: { width: 3, borderRadius: 2, marginTop: 12 },
  details: { paddingHorizontal: 16, gap: 10 },
  descRow: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 60, paddingLeft: 8, paddingRight: 10, borderRadius: 20 },
  descInput: { flex: 1, minWidth: 0, fontFamily: fonts.sans[700], fontSize: 16, paddingVertical: 8 },
  chips: { gap: 8 },
  keypad: { paddingHorizontal: 16, paddingTop: 14 },
  submit: { paddingHorizontal: 16, paddingTop: 12 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingVertical: 12 },
  categoryCell: { width: '25%', alignItems: 'center', gap: 6, paddingVertical: 12, borderRadius: 18, overflow: 'hidden' },
  search: { marginHorizontal: 16, marginTop: 14, marginBottom: 6, height: 50, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  searchInput: { flex: 1, fontFamily: fonts.sans[600], fontSize: 15 },
  groupLabel: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 },
  flabel: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10 },
  payers: { flexDirection: 'row', gap: 14, paddingHorizontal: 20 },
  payer: { alignItems: 'center', gap: 6, width: 60 },
  payerRing: { borderWidth: 2.5, borderColor: 'transparent', borderRadius: 30, padding: 2.5 },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 8, paddingHorizontal: 4 },
  rowEnd: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  preview: { marginHorizontal: 16, marginTop: 6, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 10 },
  sheetActions: { paddingHorizontal: 16, paddingTop: 12 },
  exactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4 },
  amountBox: { width: 128, height: 44, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12 },
  amountBoxInput: { flex: 1, textAlign: 'right', fontFamily: fonts.sans[800], fontSize: 16, padding: 0 },
})
