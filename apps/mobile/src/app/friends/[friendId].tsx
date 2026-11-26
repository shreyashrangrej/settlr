import { api } from '@settlr/backend/convex/_generated/api'
import type { Id } from '@settlr/backend/convex/_generated/dataModel'
import type { Currency } from '@settlr/shared/schemas'
import { useMutation, useQuery } from 'convex/react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { Button, IconButton } from '@/components/button'
import { Icons } from '@/components/icons'
import { openExpense, PaymentTile } from '@/components/ledger'
import { confirm, Sheet, SheetTitle, toast } from '@/components/overlay'
import { Screen, TopBar } from '@/components/screen'
import { Card, DayHeading, Empty, Rise, Row, RowEnd, Rows, Skeleton, SkeletonRows } from '@/components/surfaces'
import { Label, Sub, Text } from '@/components/text'
import { Avatar, Badge, CategoryTile, Tile } from '@/components/tiles'
import { useRun } from '@/lib/actions'
import { usePrefs } from '@/lib/prefs'
import { firstName, groupBy, localIsoDate, money, monthName, shortDate, signedMoney } from '@/lib/format'
import { useColors } from '@/theme'

const PAGE = 50

export default function FriendScreen() {
  const colors = useColors()
  const router = useRouter()
  const { friendId = '' } = useLocalSearchParams<{ friendId: string }>()
  const [limit, setLimit] = useState(PAGE)
  const [menu, setMenu] = useState(false)
  const friend = useQuery(api.friends.get, { friendId })
  const overview = useQuery(api.friends.overview, { friendId })
  const entries = useQuery(api.friends.entries, {
    friendId,
    q: '',
    category: 'all',
    paidBy: '',
    sort: 'date',
    order: 'desc',
    limit,
  })
  const remind = useMutation(api.friends.remind)
  const answer = useMutation(api.friends.answerPayment)
  const settleEverything = useMutation(api.friends.settleEverything)
  const { run, pending } = useRun()
  const today = localIsoDate()
  const prefs = usePrefs()

  if (friend === null) {
    return (
      <Screen>
        <TopBar />
        <Empty icon={Icons.user} title="This friend isn’t here" hint="They may have been removed." />
      </Screen>
    )
  }

  const first = friend ? firstName(friend.name) : ''
  const balances = (Object.entries(friend?.balances ?? {}) as Array<[Currency, number]>)
    .filter(([, c]) => c !== 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
  const [main, ...others] = balances
  const [currency, cents] = main ?? [undefined, 0]
  const DirIcon = cents > 0 ? Icons.in : Icons.out
  const canRemind = friend?.status === 'linked' && cents > 0 && (friend?.canRemindAt ?? 0) <= Date.now()
  const across = (Object.entries(overview?.totals ?? {}) as Array<[Currency, number]>).find(([c]) =>
    overview?.groups.some((g) => g.currency === c),
  )
  const months = groupBy(entries?.items ?? [], (e) => e.date.slice(0, 7))

  async function everything() {
    if (!across || !friend) return
    const [c, total] = across
    const ok = await confirm({
      title: `Settle everything with ${first}?`,
      body: `Records payments for ${money(total, c)} across your ledger and the groups you share, so you're square everywhere in ${c}.`,
      confirm: 'Settle everything',
      icon: Icons.layers,
    })
    if (!ok) return
    const count = await run(() => settleEverything({ friendId: friend.id, currency: c, date: today }))
    if (count) toast(`All square with ${first} · ${count === 1 ? '1 payment' : `${count} payments`} recorded`)
  }

  return (
    <View style={styles.flex}>
      <Screen>
        <TopBar
          backLabel="Back to friends"
          actions={<IconButton icon={Icons.more} label="Friend options" onPress={() => setMenu(true)} />}
        />
        {friend === undefined ? (
          <View style={styles.center}>
            <Skeleton width={76} height={76} radius={38} />
            <Skeleton width={180} height={24} style={{ marginTop: 12 }} />
          </View>
        ) : (
          <>
            <Rise index={1} style={styles.center}>
              <Avatar id={friend.id} name={friend.name} size="lg" />
              <Text accessibilityRole="header" display weight={700} size={28} lineHeight={34} tracking={-0.03} align="center" style={{ marginTop: 12 }}>
                {friend.name}
              </Text>
              <View style={{ marginTop: 8 }}>
                {friend.status === 'linked' ? (
                  <Badge tone="accent" size="md" icon={Icons.verified}>
                    Shared ledger · you both see it
                  </Badge>
                ) : friend.status === 'pending' ? (
                  <Badge tone="warn" size="md" icon={Icons.clock}>
                    Friend request sent
                  </Badge>
                ) : (
                  <Badge size="md">{friend.email ? 'Request declined' : 'Only you see this ledger'}</Badge>
                )}
              </View>
            </Rise>

            <Rise index={2}>
              <Card style={styles.balance}>
                <View style={[styles.row, { justifyContent: 'center' }]}>
                  {cents !== 0 ? <DirIcon color={cents > 0 ? colors.owed : colors.owe} size={15} /> : null}
                  <Label>{cents > 0 ? `${first} owes you` : cents < 0 ? `You owe ${first}` : 'All square'}</Label>
                </View>
                <Text
                  display
                  weight={800}
                  size={46}
                  lineHeight={52}
                  tracking={-0.04}
                  tabular
                  align="center"
                  color={cents > 0 ? colors.owed : cents < 0 ? colors.owe : colors.text}
                  style={{ marginTop: 2 }}
                >
                  {money(cents, currency ?? prefs.currency)}
                </Text>
                {others.length > 0 ? (
                  <Sub align="center" weight={700}>
                    and {others.map(([c, v]) => signedMoney(v, c)).join(', ')}
                  </Sub>
                ) : null}
                <View style={styles.buttons}>
                  <Button
                    size="md"
                    variant="contrast"
                    icon={Icons.swap}
                    style={styles.grow}
                    disabled={!currency}
                    onPress={() => router.push({ pathname: '/settle', params: { kind: 'friend', id: friend.id, currency: currency ?? '' } })}
                  >
                    Settle up
                  </Button>
                  <Button
                    size="md"
                    icon={Icons.plus}
                    style={styles.grow}
                    onPress={() => router.push({ pathname: '/add', params: { kind: 'friend', id: friend.id } })}
                  >
                    Add expense
                  </Button>
                </View>
                {canRemind ? (
                  <Button
                    size="md"
                    variant="outline"
                    icon={Icons.bellRing}
                    wide
                    style={{ marginTop: 8 }}
                    onPress={() => run(() => remind({ friendId: friend.id }), `Reminded ${first}`)}
                  >
                    {`Remind ${first}`}
                  </Button>
                ) : null}
              </Card>
            </Rise>

            {across && overview && overview.groups.length > 0 ? (
              <Rise index={3}>
                <Card onPress={everything} style={styles.across} accessibilityLabel="Settle everything">
                  <Tile hue="violet" size={40} radius={13} icon={Icons.layers} iconSize={18} />
                  <View style={styles.grow}>
                    <Text weight={700} size={15}>
                      Across everything
                    </Text>
                    <Sub numberOfLines={2}>
                      With {overview.groups.map((g) => g.name).join(', ')}, {across[1] > 0 ? `${first} owes you ` : `you owe ${first} `}
                      <Text weight={800} size={13} tabular color={across[1] > 0 ? colors.owed : colors.owe}>
                        {money(across[1], across[0])}
                      </Text>
                    </Sub>
                  </View>
                  {pending ? null : <Icons.chevR color={colors.faint} size={18} />}
                </Card>
              </Rise>
            ) : null}
          </>
        )}

        <Rise index={4} style={{ marginTop: 10 }}>
          {entries === undefined || friend === undefined ? (
            <View style={[styles.gutter, { marginTop: 10 }]}>
              <SkeletonRows count={3} />
            </View>
          ) : entries.items.length === 0 ? (
            <Card style={[styles.gutter, { marginTop: 10 }]}>
              <Empty
                title="Nothing here yet"
                hint={`Add an expense with ${first} and we'll keep the balance.`}
                action="Add expense"
                onAction={() => router.push({ pathname: '/add', params: { kind: 'friend', id: friend.id } })}
              />
            </Card>
          ) : (
            <>
              {months.map((m) => (
                <View key={m.key}>
                  <DayHeading>{monthName(m.key, today)}</DayHeading>
                  <Card style={styles.gutter}>
                    <Rows>
                      {m.items.map((e) => {
                        if (e.kind === 'payment') {
                          const incoming = e.paidBy === 'friend'
                          return (
                            <Row
                              key={e.id}
                              leading={<PaymentTile incoming={incoming} />}
                              title={incoming ? `${first} paid you` : `You paid ${first}`}
                              subtitle={
                                e.canConfirm ? (
                                  <View style={{ gap: 8 }}>
                                    <Text weight={700} size={13} color={colors.warn}>
                                      {shortDate(e.date, today)} · did you get it?
                                    </Text>
                                    <View style={styles.row}>
                                      <Button size="sm" variant="contrast" icon={Icons.check} onPress={() => run(() => answer({ entryId: e.id, confirm: true }), 'Payment confirmed')}>
                                        Got it
                                      </Button>
                                      <Button size="sm" variant="neutral" onPress={() => run(() => answer({ entryId: e.id, confirm: false }), 'Payment removed')}>
                                        Didn’t get it
                                      </Button>
                                    </View>
                                  </View>
                                ) : (
                                  `${shortDate(e.date, today)}${e.unconfirmed ? ` · waiting for ${incoming ? 'you' : first} to confirm` : e.note ? ` · ${e.note}` : ''}`
                                )
                              }
                              end={<RowEnd label="payment" amount={money(e.amountCents, e.currency)} />}
                            />
                          )
                        }
                        const lent = e.effectCents > 0
                        return (
                          <Row
                            key={e.id}
                            leading={<CategoryTile category={e.category} />}
                            title={e.description}
                            subtitle={`${shortDate(e.date, today)} · ${e.paidBy === 'me' ? 'you' : first} paid ${money(e.amountCents, e.currency)} · ${e.split === 'equal' ? 'split' : e.split === 'full' ? 'owed in full' : 'exact'}`}
                            end={
                              <RowEnd
                                label={lent ? 'you lent' : 'you borrowed'}
                                amount={money(e.effectCents, e.currency)}
                                color={lent ? colors.owed : colors.owe}
                              />
                            }
                            onPress={() => openExpense(router, { source: 'friend', id: e.id, parentId: friend.id, date: e.date })}
                          />
                        )
                      })}
                    </Rows>
                  </Card>
                </View>
              ))}
              {entries.hasMore ? (
                <View style={[styles.gutter, { marginTop: 14 }]}>
                  <Button variant="neutral" size="md" onPress={() => setLimit((l) => l + PAGE)}>
                    Show more
                  </Button>
                </View>
              ) : null}
            </>
          )}
        </Rise>
      </Screen>
      {friend ? <FriendMenu open={menu} onClose={() => setMenu(false)} friend={friend} /> : null}
    </View>
  )
}

function FriendMenu({
  open,
  onClose,
  friend,
}: {
  open: boolean
  onClose: () => void
  friend: { id: Id<'friends'>; name: string; email: string | null; status: string | null; balances: Record<string, number> }
}) {
  const colors = useColors()
  const router = useRouter()
  const remove = useMutation(api.friends.remove)
  const requestLink = useMutation(api.friends.requestLink)
  const { run } = useRun()

  async function del() {
    onClose()
    const ok = await confirm({
      title: `Remove ${friend.name}?`,
      body: 'Your ledger with them is deleted too. Shared groups aren’t affected. This can’t be undone.',
      confirm: 'Remove',
      destructive: true,
    })
    if (!ok) return
    const done = await run(() => remove({ friendId: friend.id }))
    if (done !== undefined) {
      toast(`Removed ${friend.name}`)
      router.back()
    }
  }

  return (
    <Sheet open={open} onClose={onClose} label="Friend options">
      <SheetTitle kicker={friend.email ?? 'No email'}>{friend.name}</SheetTitle>
      <View style={{ paddingVertical: 8 }}>
        {friend.email && friend.status !== 'linked' && friend.status !== 'pending' ? (
          <Row
            minHeight={56}
            leading={<Tile size={40} radius={13} icon={Icons.verified} iconSize={18} />}
            title="Send a friend request"
            subtitle="Share this ledger with them"
            titleSize={15}
            onPress={() => {
              onClose()
              run(() => requestLink({ friendId: friend.id }), 'Request sent')
            }}
          />
        ) : null}
        <Row
          minHeight={56}
          leading={<Tile size={40} radius={13} bg={colors.oweSoft} fg={colors.owe} icon={Icons.trash} iconSize={18} />}
          title="Remove friend"
          titleColor={colors.owe}
          titleSize={15}
          onPress={del}
        />
      </View>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gutter: { marginHorizontal: 16 },
  center: { alignItems: 'center', paddingHorizontal: 20 },
  balance: { marginTop: 20, marginHorizontal: 16, padding: 18 },
  buttons: { flexDirection: 'row', gap: 8, marginTop: 14 },
  across: { marginTop: 12, marginHorizontal: 16, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
})
