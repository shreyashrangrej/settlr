import { api } from '@settlr/backend/convex/_generated/api'
import type { Id } from '@settlr/backend/convex/_generated/dataModel'
import { useMutation, useQuery } from 'convex/react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'

import { Button, IconButton } from '@/components/button'
import { Icons } from '@/components/icons'
import { Screen, TopBar } from '@/components/screen'
import { Card, Empty, Rise, Row, Rows, Section, SkeletonRows } from '@/components/surfaces'
import { Sub, Text, Title } from '@/components/text'
import { Avatar, Badge, GroupTile } from '@/components/tiles'
import { useRun } from '@/lib/actions'
import { firstName, money, shortDate, localIsoDate } from '@/lib/format'
import { useColors, useReduceMotion } from '@/theme'

export default function GroupBalancesScreen() {
  const colors = useColors()
  const router = useRouter()
  const { groupId = '' } = useLocalSearchParams<{ groupId: string }>()
  const group = useQuery(api.groups.get, { groupId })
  const payments = useQuery(api.groups.payments, { groupId })
  const remindMember = useMutation(api.groups.remindMember)
  const answer = useMutation(api.groups.answerPayment)
  const { run } = useRun()
  const today = localIsoDate()

  if (group === null) {
    return (
      <Screen>
        <TopBar />
        <Empty icon={Icons.users} title="This group isn’t here" />
      </Screen>
    )
  }

  const meId = group?.meMemberId
  const member = (id: string) => group?.members.find((m) => m.id === id)
  const name = (id: string) => (id === meId ? 'You' : (member(id)?.name ?? 'Former member'))
  const short = (id: string) => (id === meId ? 'you' : firstName(name(id)))
  const sorted = [...(group?.members ?? [])].sort((a, b) => b.netCents - a.netCents)
  const largest = Math.max(1, ...sorted.map((m) => Math.abs(m.netCents)))
  const plan = [...(group?.settlements ?? [])].sort(
    (a, b) => Number(b.to === meId || b.from === meId) - Number(a.to === meId || a.from === meId),
  )

  function record(from: string, to: string, amountCents: number) {
    router.push({
      pathname: '/settle',
      params: { kind: 'group', id: groupId, from, to, amount: String(amountCents) },
    })
  }

  return (
    <Screen>
      <TopBar backLabel={group ? `Back to ${group.name}` : 'Back'} />
      <View style={styles.pad}>
        {group ? (
          <View style={styles.kicker}>
            <GroupTile id={group.id} name={group.name} size={22} radius={8} />
            <Sub>{group.name}</Sub>
          </View>
        ) : null}
        <Title style={{ marginTop: 6 }}>Balances</Title>
      </View>

      {group === undefined ? (
        <View style={[styles.gutter, { marginTop: 18 }]}>
          <SkeletonRows count={4} />
        </View>
      ) : (
        <>
          <Rise index={1}>
            <Card style={[styles.gutter, { marginTop: 18, paddingVertical: 4 }]}>
              <Rows inset={62}>
                {sorted.map((m, i) => (
                  <Row
                    key={m.id}
                    minHeight={60}
                    leading={<Avatar id={m.id} name={m.name} me={m.id === meId} size="sm" />}
                    title={m.id === meId ? 'You' : m.name}
                    titleSize={15}
                    subtitle={
                      <Text weight={700} size={13} color={m.netCents > 0 ? colors.owed : m.netCents < 0 ? colors.owe : colors.muted}>
                        {m.netCents > 0
                          ? `${m.id === meId ? 'get' : 'gets'} back ${money(m.netCents, group.currency)}`
                          : m.netCents < 0
                            ? `${m.id === meId ? 'owe' : 'owes'} ${money(m.netCents, group.currency)}`
                            : 'settled up'}
                      </Text>
                    }
                    end={<ZeroBar cents={m.netCents} largest={largest} index={i} />}
                  />
                ))}
              </Rows>
            </Card>
          </Rise>

          <Section
            title="Settle-up plan"
            right={plan.length > 1 ? <Badge tone="accent">Fewest payments</Badge> : undefined}
            style={{ marginTop: 28 }}
          />
          <Sub style={[styles.pad, { marginTop: -6, marginBottom: 10 }]}>
            {plan.length === 0
              ? 'Everyone is square. Nothing to pay.'
              : plan.length === 1
                ? 'One payment clears every balance'
                : `${plan.length} payments clear every balance`}
          </Sub>
          {plan.length > 0 ? (
            <Rise index={3}>
              <Card style={[styles.gutter, { paddingVertical: 4, overflow: 'hidden' }]}>
                <Rows inset={82}>
                  {plan.map((s) => {
                    const mine = s.from === meId || s.to === meId
                    const fromName = member(s.from)?.name ?? 'Former member'
                    return (
                      <Row
                        key={`${s.from}-${s.to}`}
                        style={mine ? { backgroundColor: colors.accentSoft } : undefined}
                        leading={<Pair from={s.from} to={s.to} meId={meId} name={name} ring={mine ? colors.accentSoft : colors.surface} />}
                        title={`${s.from === meId ? 'You' : firstName(fromName)} ${s.from === meId ? 'pay' : 'pays'} ${short(s.to)}`}
                        titleSize={15}
                        subtitle={
                          <Text weight={800} size={13} tabular color={s.to === meId ? colors.owed : s.from === meId ? colors.owe : colors.muted}>
                            {money(s.amountCents, group.currency)}
                          </Text>
                        }
                        end={
                          <View style={styles.planEnd}>
                            {s.to === meId && member(s.from)?.linked ? (
                              <IconButton
                                icon={Icons.bellRing}
                                label={`Remind ${firstName(fromName)}`}
                                size={38}
                                iconSize={18}
                                bg={colors.surface}
                                onPress={() =>
                                  run(
                                    () => remindMember({ groupId: group.id as Id<'groups'>, memberId: s.from }),
                                    `Reminded ${firstName(fromName)}`,
                                  )
                                }
                              />
                            ) : null}
                            <Button size="sm" variant={mine ? 'primary' : 'neutral'} onPress={() => record(s.from, s.to, s.amountCents)}>
                              Record
                            </Button>
                          </View>
                        }
                      />
                    )
                  })}
                </Rows>
              </Card>
            </Rise>
          ) : null}

          {payments && payments.length > 0 ? (
            <>
              <Section title="Recent payments" style={{ marginTop: 26 }} />
              <Rise index={4}>
                <Card style={[styles.gutter, { paddingVertical: 4 }]}>
                  <Rows inset={82}>
                    {payments.map((p) => (
                      <Row
                        key={p.id}
                        leading={<Pair from={p.from} to={p.to} meId={meId} name={name} ring={colors.surface} />}
                        title={`${p.from === meId ? 'You' : firstName(name(p.from))} paid ${short(p.to)} ${money(p.amountCents, group.currency)}`}
                        titleSize={15}
                        subtitle={
                          p.canConfirm ? (
                            <View style={{ gap: 8 }}>
                              <Text weight={700} size={13} color={colors.warn}>
                                Did you get it? The balance already counts it.
                              </Text>
                              <View style={styles.confirm}>
                                <Button
                                  size="sm"
                                  variant="contrast"
                                  icon={Icons.check}
                                  onPress={() => run(() => answer({ paymentId: p.id, confirm: true }), 'Payment confirmed')}
                                >
                                  Got it
                                </Button>
                                <Button
                                  size="sm"
                                  variant="neutral"
                                  onPress={() => run(() => answer({ paymentId: p.id, confirm: false }), 'Payment removed')}
                                >
                                  Didn’t get it
                                </Button>
                              </View>
                            </View>
                          ) : p.unconfirmed ? (
                            <View style={styles.row}>
                              <Icons.alert color={colors.warn} size={15} />
                              <Text weight={700} size={13} color={colors.warn}>
                                Waiting for {short(p.to)} to confirm
                              </Text>
                            </View>
                          ) : (
                            `${shortDate(p.date, today)} · confirmed`
                          )
                        }
                      />
                    ))}
                  </Rows>
                </Card>
              </Rise>
            </>
          ) : null}

          <View style={[styles.gutter, { marginTop: 16, gap: 10 }]}>
            {group.members.length > 1 ? (
              <Button
                variant="outline"
                icon={Icons.swap}
                onPress={() => {
                  const other = group.members.find((m) => m.id !== meId)
                  if (other) record(meId!, other.id, 0)
                }}
              >
                Record another payment
              </Button>
            ) : null}
            <Sub align="center" style={{ paddingHorizontal: 20 }}>
              The bell reminds someone who owes you. Payments you record move the balance now; whoever got the money is asked to
              confirm.
            </Sub>
          </View>
        </>
      )}
    </Screen>
  )
}

/** Two overlapping avatars: who pays (top left) and who gets it. */
function Pair({
  from,
  to,
  meId,
  name,
  ring,
}: {
  from: string
  to: string
  meId: string | undefined
  name: (id: string) => string
  ring: string
}) {
  return (
    <View style={styles.pair}>
      <Avatar id={from} name={name(from)} me={from === meId} size="sm" style={styles.pairFrom} />
      <Avatar id={to} name={name(to)} me={to === meId} size="sm" ring={ring} style={styles.pairTo} />
    </View>
  )
}

/** A bar growing out of the zero line: right and green for credit, left and red for debt. */
function ZeroBar({ cents, largest, index }: { cents: number; largest: number; index: number }) {
  const colors = useColors()
  const reduce = useReduceMotion()
  const grow = useRef(new Animated.Value(reduce ? 1 : 0)).current
  useEffect(() => {
    if (reduce) return
    Animated.timing(grow, {
      toValue: 1,
      duration: 800,
      delay: 150 + index * 30,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: false,
    }).start()
  }, [grow, index, reduce])
  const share = Math.abs(cents) / largest
  const width = grow.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${Math.round(share * 100)}%`] })
  return (
    <View style={styles.zero} accessibilityElementsHidden>
      <View style={[styles.half, { alignItems: 'flex-end' }]}>
        {cents < 0 ? <Animated.View style={[styles.bar, styles.left, { width, backgroundColor: colors.owe }]} /> : null}
      </View>
      <View style={[styles.axis, { backgroundColor: colors.dim }]} />
      <View style={styles.half}>
        {cents > 0 ? <Animated.View style={[styles.bar, styles.right, { width, backgroundColor: colors.owed }]} /> : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 20 },
  gutter: { marginHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planEnd: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  confirm: { flexDirection: 'row', gap: 8 },
  pair: { width: 52, height: 44 },
  pairFrom: { position: 'absolute', left: 0, top: 0 },
  pairTo: { position: 'absolute', right: -2, bottom: -2 },
  zero: { width: 120, height: 10, flexDirection: 'row' },
  half: { flex: 1 },
  axis: { width: 1.5 },
  bar: { height: 10 },
  left: { borderTopLeftRadius: 5, borderBottomLeftRadius: 5 },
  right: { borderTopRightRadius: 5, borderBottomRightRadius: 5 },
})
