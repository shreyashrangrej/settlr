import { api } from '@settlr/backend/convex/_generated/api'
import type { Id } from '@settlr/backend/convex/_generated/dataModel'
import { categoryLabel } from '@settlr/shared/format'
import type { Category, Currency } from '@settlr/shared/schemas'
import { equalSplit } from '@settlr/shared/split'
import { useMutation, useQuery } from 'convex/react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useState } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Button, IconButton } from '@/components/button'
import { CATEGORY_ICON, Icons } from '@/components/icons'
import { confirm, toast } from '@/components/overlay'
import { Screen, TopBar } from '@/components/screen'
import { Card, Empty, Rise, Row, RowEnd, Rows, Section, Skeleton } from '@/components/surfaces'
import { Label, Sub, Text } from '@/components/text'
import { Avatar, Badge, Tile } from '@/components/tiles'
import { errorText, useRun } from '@/lib/actions'
import { CATEGORY_HUE } from '@/lib/category'
import { dateChip, firstName, localIsoDate, money, timeAgo } from '@/lib/format'
import { fonts, useColors } from '@/theme'

type Params = { kind: 'group' | 'friend' | 'personal'; id: string; parent?: string; date?: string }

type Person = { id: string; name: string; me: boolean; share: number }

type Detail = {
  description: string
  amountCents: number
  currency: Currency
  category: Category
  date: string
  tags: Array<string>
  where: { kind: 'group' | 'friend'; id: string; name: string } | null
  payer: Person | null
  people: Array<Person>
  splitLabel: string
  hasReceipt: boolean
}

/** One expense: what, who paid, how it's split, the receipt and comments. */
export default function ExpenseScreen() {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const params = useLocalSearchParams<Params>()
  const today = localIsoDate()
  const detail = useDetail(params)
  const receipt = useQuery(api.receipts.forExpense, detail?.hasReceipt ? { source: params.kind, expenseId: params.id } : 'skip')
  const removeGroup = useMutation(api.groups.removeExpense)
  const removeFriend = useMutation(api.friends.removeEntry)
  const removePersonal = useMutation(api.personal.remove)
  const restore = useMutation(api.trash.restore)
  const [deleting, setDeleting] = useState(false)

  if (detail === null) {
    return (
      <Screen>
        <TopBar />
        <Empty title="This expense isn’t here" hint="It may have been deleted." />
      </Screen>
    )
  }

  function edit() {
    router.push({ pathname: '/add', params: { edit: params.id, kind: params.kind, parent: params.parent ?? '', date: detail?.date ?? params.date ?? '' } })
  }

  async function del() {
    if (!detail) return
    const ok = await confirm({
      title: `Delete “${detail.description}”?`,
      body:
        detail.where?.kind === 'group'
          ? `Balances are updated for everyone in ${detail.where.name}. You can restore it from Trash for 30 days.`
          : 'You can restore it from Trash for 30 days.',
      confirm: 'Delete',
      destructive: true,
    })
    if (!ok) return
    setDeleting(true)
    try {
      const trashId =
        params.kind === 'group'
          ? await removeGroup({ expenseId: params.id as Id<'groupExpenses'> })
          : params.kind === 'friend'
            ? await removeFriend({ entryId: params.id as Id<'friendEntries'> })
            : await removePersonal({ expenseId: params.id as Id<'personalExpenses'> })
      router.back()
      toast('Deleted. It’s in Trash for 30 days.', {
        icon: Icons.trash,
        tone: 'bad',
        action: trashId
          ? {
              label: 'Undo',
              onPress: () => {
                restore({ trashId })
                  .then(() => toast('Restored'))
                  .catch((err) => toast(errorText(err), { tone: 'bad' }))
              },
            }
          : undefined,
      })
    } catch (err) {
      toast(errorText(err), { tone: 'bad' })
      setDeleting(false)
    }
  }

  const me = detail?.people.find((p) => p.me)
  const payerIsMe = detail?.payer?.me ?? false

  return (
    <Screen
      footer={
        detail ? (
          <View style={styles.footer}>
            <Button variant="tonal" icon={Icons.pen} style={styles.flex} onPress={edit}>
              Edit
            </Button>
            <Button variant="dangerTonal" icon={Icons.trash} style={styles.flex} onPress={del} loading={deleting}>
              Delete
            </Button>
          </View>
        ) : undefined
      }
    >
      <TopBar
        backLabel={detail?.where ? `Back to ${detail.where.name}` : 'Back'}
        actions={detail ? <IconButton icon={Icons.pen} label="Edit" onPress={edit} /> : null}
      />
      {detail === undefined ? (
        <View style={styles.center}>
          <Skeleton width={64} height={64} radius={22} />
          <Skeleton width={200} height={24} style={{ marginTop: 14 }} />
          <Skeleton width={140} height={44} style={{ marginTop: 10 }} />
        </View>
      ) : (
        <>
          <Rise index={1} style={styles.center}>
            <Tile hue={CATEGORY_HUE[detail.category]} size={64} radius={22} icon={Icons[CATEGORY_ICON[detail.category]]} iconSize={34} />
            <Text accessibilityRole="header" display weight={700} size={26} lineHeight={32} tracking={-0.025} align="center" style={{ marginTop: 14 }}>
              {detail.description}
            </Text>
            <Text display weight={800} size={50} lineHeight={58} tracking={-0.045} tabular style={{ marginTop: 2 }}>
              {money(detail.amountCents, detail.currency)}
            </Text>
            <View style={styles.badges}>
              {detail.where ? (
                <Badge size="md" tone="accent">
                  {detail.where.name}
                </Badge>
              ) : (
                <Badge size="md" bg={colors.hues.amber.bg} fg={colors.hues.amber.fg}>
                  Personal
                </Badge>
              )}
              <Badge size="md" icon={Icons.cal}>
                {dateChip(detail.date, today)}
              </Badge>
              <Badge size="md" icon={Icons.tag}>
                {categoryLabel(detail.category)}
              </Badge>
              {detail.tags.map((t) => (
                <Badge key={t} size="md" icon={Icons.hash}>
                  {t}
                </Badge>
              ))}
            </View>
          </Rise>

          {detail.payer ? (
            <Rise index={2}>
              <Card style={[styles.gutter, { marginTop: 22 }]}>
                <Row
                  leading={<Avatar id={detail.payer.id} name={detail.payer.name} me={detail.payer.me} />}
                  title={
                    <View>
                      <Label>Paid by</Label>
                      <Text weight={700} size={15.5}>
                        {detail.payer.me ? 'You' : detail.payer.name}
                      </Text>
                    </View>
                  }
                  end={<RowEnd amount={money(detail.amountCents, detail.currency)} />}
                />
              </Card>
            </Rise>
          ) : null}

          {detail.people.length > 0 ? (
            <>
              <Section title={detail.splitLabel} style={{ marginTop: 20 }} />
              <Rise index={3}>
                <Card style={[styles.gutter, { paddingVertical: 4 }]}>
                  <Rows inset={62}>
                    {detail.people.map((p) => {
                      const highlight = p.me && !payerIsMe && p.share > 0
                      return (
                        <Row
                          key={p.id}
                          minHeight={56}
                          style={highlight ? { backgroundColor: colors.oweSoft, marginHorizontal: 6, borderRadius: 18, paddingHorizontal: 10 } : undefined}
                          leading={<Avatar id={p.id} name={p.name} me={p.me} size="sm" />}
                          title={p.me ? 'You' : p.name}
                          titleSize={15}
                          subtitle={
                            highlight ? (
                              <Text weight={700} size={13} color={colors.owe}>
                                you owe {firstName(detail.payer?.name ?? '')}
                              </Text>
                            ) : undefined
                          }
                          end={
                            <Text weight={800} size={15.5} tabular color={highlight ? colors.owe : colors.muted}>
                              {money(p.share, detail.currency)}
                            </Text>
                          }
                        />
                      )
                    })}
                  </Rows>
                </Card>
              </Rise>
              {me && payerIsMe && detail.amountCents - me.share > 0 ? (
                <Sub style={[styles.pad, { marginTop: 10 }]}>
                  You paid, so you lent {money(detail.amountCents - me.share, detail.currency)} to the others.
                </Sub>
              ) : null}
            </>
          ) : null}

          {detail.hasReceipt ? (
            <Rise index={4}>
              <Card
                style={[styles.gutter, styles.receipt]}
                onPress={receipt ? () => WebBrowser.openBrowserAsync(receipt.url) : undefined}
                accessibilityLabel="Open the receipt"
              >
                <View style={[styles.paper, { backgroundColor: '#FBFAF6' }]}>
                  {[60, 100, 80, 100, 70].map((w, i) => (
                    <View key={i} style={{ height: i === 0 ? 4 : 3, width: `${w}%`, backgroundColor: i === 0 ? '#C9C6BC' : '#DEDBD2', borderRadius: 2 }} />
                  ))}
                </View>
                <View style={styles.flex}>
                  <Text weight={700} size={15.5}>
                    Receipt
                  </Text>
                  <Sub numberOfLines={1}>
                    {receipt ? `${receipt.fileName} · ${(receipt.size / 1024 / 1024).toFixed(1)} MB` : 'Loading…'}
                  </Sub>
                </View>
                <Icons.chevR color={colors.faint} size={18} />
              </Card>
            </Rise>
          ) : null}

          {params.kind === 'group' ? <Comments expenseId={params.id} /> : null}
          <View style={{ height: insets.bottom ? 0 : 8 }} />
        </>
      )}
    </Screen>
  )
}

function Comments({ expenseId }: { expenseId: string }) {
  const colors = useColors()
  const comments = useQuery(api.groups.comments, { expenseId })
  const add = useMutation(api.groups.addComment)
  const { pending, run } = useRun()
  const [body, setBody] = useState('')

  async function send() {
    const text = body.trim()
    if (!text) return
    const done = await run(() => add({ expenseId: expenseId as Id<'groupExpenses'>, body: text }))
    if (done !== undefined) setBody('')
  }

  return (
    <>
      <Section
        title="Comments"
        right={<Label>Everyone on it is told</Label>}
        style={{ marginTop: 22 }}
      />
      <Card style={[styles.gutter, styles.comments]}>
        {comments?.map((c) => (
          <View key={c.id} style={styles.comment}>
            <Avatar name={c.name} me={c.mine} size="sm" />
            <View style={styles.flex}>
              <Text weight={800} size={13}>
                {c.mine ? 'You' : firstName(c.name)}{' '}
                <Text weight={600} size={13} color="faint">
                  · {timeAgo(c.at)}
                </Text>
              </Text>
              <View style={[styles.bubble, { backgroundColor: colors.surface2 }]}>
                <Text weight={500} size={14.5} lineHeight={20}>
                  {c.body}
                </Text>
              </View>
            </View>
          </View>
        ))}
        {comments && comments.length === 0 ? <Sub style={{ paddingBottom: 4 }}>No comments yet.</Sub> : null}
        <View style={[styles.commentInput, { backgroundColor: colors.surface2 }]}>
          <TextInput
            accessibilityLabel="Add a comment"
            value={body}
            onChangeText={setBody}
            placeholder="Add a comment…"
            placeholderTextColor={colors.faint}
            selectionColor={colors.accent}
            maxLength={500}
            onSubmitEditing={send}
            style={[styles.flex, { color: colors.text, fontFamily: fonts.sans[600], fontSize: 14.5 }]}
          />
          <IconButton icon={Icons.send} label="Send comment" size={38} iconSize={17} bg={colors.accent} color={colors.onAccent} onPress={send} disabled={pending || !body.trim()} />
        </View>
      </Card>
    </>
  )
}

/** The expense, from whichever ledger it's in. Undefined while loading, null if missing. */
function useDetail(params: Params): Detail | null | undefined {
  const month = (params.date ?? '').slice(0, 7)
  const isGroup = params.kind === 'group' && params.parent
  const group = useQuery(api.groups.get, isGroup ? { groupId: params.parent! } : 'skip')
  const groupExpense = useQuery(api.groups.expense, isGroup ? { groupId: params.parent!, expenseId: params.id } : 'skip')
  const listed = useQuery(
    api.groups.expenses,
    isGroup ? { groupId: params.parent!, q: '', category: 'all', paidBy: '', sort: 'date', order: 'desc', limit: 500 } : 'skip',
  )
  const friend = useQuery(api.friends.get, params.kind === 'friend' && params.parent ? { friendId: params.parent } : 'skip')
  const entries = useQuery(
    api.friends.entries,
    params.kind === 'friend' && params.parent
      ? { friendId: params.parent, q: '', category: 'all', paidBy: '', sort: 'date', order: 'desc', limit: 500 }
      : 'skip',
  )
  const personal = useQuery(api.personal.month, params.kind === 'personal' && month ? { month } : 'skip')

  if (params.kind === 'group') {
    if (group === undefined || groupExpense === undefined) return undefined
    if (!group || !groupExpense) return null
    const order = group.members.map((m) => m.id)
    const owed: Record<string, number> =
      listed?.items.find((i) => i.id === params.id)?.owed ??
      groupExpense.split?.owed ??
      Object.fromEntries(equalSplit(groupExpense.amountCents, groupExpense.splitAmong, order))
    const person = (id: string, share = 0): Person => ({
      id,
      name: group.members.find((m) => m.id === id)?.name ?? 'Former member',
      me: id === group.meMemberId,
      share,
    })
    const people = order.filter((id) => (owed[id] ?? 0) > 0).map((id) => person(id, owed[id]))
    const mode = groupExpense.split?.mode
    const shares = people.map((p) => p.share)
    const even = shares.every((s) => Math.abs(s - shares[0]!) <= 1)
    return {
      description: groupExpense.description,
      amountCents: groupExpense.amountCents,
      currency: group.currency,
      category: groupExpense.category,
      date: groupExpense.date,
      tags: groupExpense.tags,
      where: { kind: 'group', id: group.id, name: group.name },
      payer: person(groupExpense.paidBy),
      people,
      splitLabel:
        !mode && even
          ? `Split equally · ${people.length} ${people.length === 1 ? 'person' : 'people'}`
          : `Split by ${mode === 'percent' ? '%' : mode === 'shares' ? 'shares' : mode === 'items' ? 'items' : 'amounts'} · ${people.length} people`,
      hasReceipt: groupExpense.receiptId !== null,
    }
  }
  if (params.kind === 'friend') {
    if (friend === undefined || entries === undefined) return undefined
    const e = entries.items.find((i) => i.id === params.id)
    if (!friend || !e || e.kind !== 'expense') return null
    const theirShare = e.split === 'equal' ? Math.floor(e.amountCents / 2) : e.split === 'exact' ? Math.min(e.owedCents ?? 0, e.amountCents) : e.amountCents
    const payerIsMe = e.paidBy === 'me'
    const mine = payerIsMe ? e.amountCents - theirShare : theirShare
    const theirs = e.amountCents - mine
    const me: Person = { id: 'me', name: 'You', me: true, share: mine }
    const them: Person = { id: friend.id, name: friend.name, me: false, share: theirs }
    return {
      description: e.description,
      amountCents: e.amountCents,
      currency: e.currency,
      category: e.category,
      date: e.date,
      tags: e.tags ?? [],
      where: { kind: 'friend', id: friend.id, name: friend.name },
      payer: payerIsMe ? me : them,
      people: [me, them].filter((p) => p.share > 0),
      splitLabel: e.split === 'equal' ? 'Split equally · 2 people' : e.split === 'full' ? 'Owed in full' : 'Split by amount',
      hasReceipt: Boolean(e.receiptId),
    }
  }
  if (personal === undefined) return undefined
  const e = personal?.items.find((i) => i.id === params.id)
  if (!e) return null
  return {
    description: e.description,
    amountCents: e.amountCents,
    currency: e.currency,
    category: e.category,
    date: e.date,
    tags: e.tags,
    where: null,
    payer: null,
    people: [],
    splitLabel: '',
    hasReceipt: e.receiptId !== null,
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  gutter: { marginHorizontal: 16 },
  pad: { paddingHorizontal: 20 },
  center: { alignItems: 'center', paddingHorizontal: 20 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 8 },
  footer: { flexDirection: 'row', gap: 10 },
  receipt: { marginTop: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 14 },
  paper: { width: 52, height: 64, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 7, gap: 4, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  comments: { paddingTop: 14, paddingHorizontal: 14, paddingBottom: 10, gap: 12 },
  comment: { flexDirection: 'row', gap: 10 },
  bubble: { marginTop: 3, paddingVertical: 10, paddingHorizontal: 12, borderTopLeftRadius: 4, borderTopRightRadius: 16, borderBottomRightRadius: 16, borderBottomLeftRadius: 16 },
  commentInput: { height: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 16, paddingRight: 5 },
})

