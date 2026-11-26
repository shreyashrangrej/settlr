import { api } from '@settlr/backend/convex/_generated/api'
import type { Id } from '@settlr/backend/convex/_generated/dataModel'
import { plural } from '@settlr/shared/format'
import { useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Animated, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Button, IconButton, usePressScale } from '@/components/button'
import { Chip, ChipRow } from '@/components/controls'
import { Icons } from '@/components/icons'
import { effectOf, openExpense } from '@/components/ledger'
import { confirm, Sheet, SheetTitle, toast } from '@/components/overlay'
import { Screen, TopBar } from '@/components/screen'
import { Bar, Card, DayHeading, Empty, Rise, Row, RowEnd, Rows, Skeleton, SkeletonRows } from '@/components/surfaces'
import { Label, Sub, Text, Title } from '@/components/text'
import { AvatarStack, CategoryTile, GroupTile, Tile } from '@/components/tiles'
import { useRun } from '@/lib/actions'
import { dayHeading, firstName, groupBy, localIsoDate, money } from '@/lib/format'
import { tick } from '@/lib/haptics'
import { useColors } from '@/theme'

const PAGE = 50

export default function GroupScreen() {
  const colors = useColors()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { groupId = '' } = useLocalSearchParams<{ groupId: string }>()
  const [limit, setLimit] = useState(PAGE)
  const [menu, setMenu] = useState(false)
  const group = useQuery(api.groups.get, { groupId })
  const list = useQuery(api.groups.expenses, {
    groupId,
    q: '',
    category: 'all',
    paidBy: '',
    sort: 'date',
    order: 'desc',
    limit,
  })
  const today = localIsoDate()
  const fab = usePressScale()

  if (group === null) {
    return (
      <Screen>
        <TopBar />
        <Empty icon={Icons.users} title="This group isn’t here" hint="It may have been deleted, or you were taken out of it." />
      </Screen>
    )
  }

  const me = group?.members.find((m) => m.id === group.meMemberId)
  const myNet = me?.netCents ?? 0
  const name = (id: string) =>
    id === group?.meMemberId ? 'You' : (group?.members.find((m) => m.id === id)?.name ?? 'Former member')
  const plan = group?.settlements ?? []
  const payMe = plan.filter((s) => s.to === group?.meMemberId).map((s) => firstName(name(s.from)))
  const iPay = plan.filter((s) => s.from === group?.meMemberId).map((s) => firstName(name(s.to)))
  const planLine =
    myNet > 0 && payMe.length
      ? `${joinNames(payMe)} ${payMe.length === 1 ? 'pays' : 'pay'} you in the plan`
      : myNet < 0 && iPay.length
        ? `You pay ${joinNames(iPay)} in the plan`
        : 'Nobody owes you anything here'

  const days = groupBy(list?.items ?? [], (e) => e.date)

  return (
    <View style={styles.flex}>
      <Screen contentStyle={{ paddingBottom: insets.bottom + 110 }}>
        <TopBar
          backLabel="Back to groups"
          actions={<IconButton icon={Icons.more} label="Group options" onPress={() => setMenu(true)} />}
        />
        {group === undefined ? (
          <View style={styles.headLoading}>
            <Skeleton width={64} height={64} radius={22} />
            <View style={{ gap: 10, flex: 1 }}>
              <Skeleton width="60%" height={24} />
              <Skeleton width="40%" />
            </View>
          </View>
        ) : (
          <>
            <Rise index={1} style={styles.head}>
              <GroupTile id={group.id} name={group.name} size={64} radius={22} />
              <View style={styles.grow}>
                <Title numberOfLines={2}>{group.name}</Title>
                <View style={styles.meta}>
                  <AvatarStack
                    ring={colors.bg}
                    people={group.members.map((m) => ({ id: m.id, name: m.name, me: m.id === group.meMemberId }))}
                  />
                  <Sub>
                    {plural(group.members.length, 'person', 'people')} · {group.currency}
                  </Sub>
                </View>
              </View>
            </Rise>

            <Rise index={2}>
              <Card style={styles.balance}>
                <View style={styles.grow}>
                  <Label>Your balance</Label>
                  <View style={styles.balanceLine}>
                    <Text
                      display
                      weight={800}
                      size={30}
                      lineHeight={36}
                      tabular
                      color={myNet > 0 ? colors.owed : myNet < 0 ? colors.owe : colors.text}
                    >
                      {money(myNet, group.currency)}
                    </Text>
                    <Text weight={700} size={14} color={myNet > 0 ? colors.owed : myNet < 0 ? colors.owe : colors.muted}>
                      {myNet > 0 ? 'you’re owed' : myNet < 0 ? 'you owe' : 'all square'}
                    </Text>
                  </View>
                  <Sub style={{ marginTop: 2 }}>{planLine}</Sub>
                </View>
                {plan.length > 0 ? (
                  <Button size="md" variant="contrast" onPress={() => router.push(`/groups/${group.id}/balances`)}>
                    Settle up
                  </Button>
                ) : null}
              </Card>
            </Rise>

            {group.budgetCents ? (
              <Rise index={2}>
                <View style={[styles.budget, { backgroundColor: colors.surface2 }]}>
                  <View style={styles.budgetHead}>
                    <View style={styles.row}>
                      <Icons.piggy color={colors.text} size={15} />
                      <Text weight={700} size={13.5}>
                        Trip budget
                      </Text>
                    </View>
                    <Text weight={700} size={13.5} tabular>
                      <Text weight={800} size={13.5} color={group.totalCents > group.budgetCents ? colors.owe : colors.owed}>
                        {group.totalCents > group.budgetCents
                          ? `${money(group.totalCents - group.budgetCents, group.currency)} over`
                          : `${money(group.budgetCents - group.totalCents, group.currency)} left`}
                      </Text>
                      <Text weight={600} size={13.5} color="muted">
                        {' '}
                        of {money(group.budgetCents, group.currency)}
                      </Text>
                    </Text>
                  </View>
                  <View style={{ marginTop: 8 }}>
                    <Bar value={group.totalCents / group.budgetCents} color={colors.accent} height={6} track={colors.surface3} />
                  </View>
                </View>
              </Rise>
            ) : null}

            <Rise index={3} style={{ marginTop: 14 }}>
              <ChipRow>
                <Chip tone="line" icon={Icons.swap} onPress={() => router.push(`/groups/${group.id}/balances`)}>
                  Balances
                </Chip>
                <Chip tone="line" icon={Icons.users} onPress={() => setMenu(true)}>
                  {plural(group.members.length, 'member')}
                </Chip>
              </ChipRow>
            </Rise>
          </>
        )}

        <Rise index={4} style={{ marginTop: 18 }}>
          {list === undefined || group === undefined ? (
            <View style={styles.gutter}>
              <SkeletonRows count={4} />
            </View>
          ) : list.items.length === 0 ? (
            <Card style={styles.gutter}>
              <Empty
                title="No expenses yet"
                hint="Add the first one and we'll split it."
                action="Add expense"
                onAction={() => router.push({ pathname: '/add', params: { kind: 'group', id: group.id } })}
              />
            </Card>
          ) : (
            <>
              {days.map((day) => (
                <View key={day.key}>
                  <DayHeading>{dayHeading(day.key, today)}</DayHeading>
                  <Card style={styles.gutter}>
                    <Rows>
                      {day.items.map((e) => {
                        const share = e.owed[group.meMemberId] ?? 0
                        const youPaid = e.paidBy === group.meMemberId
                        const effect = effectOf(youPaid, e.amountCents, share)
                        const people = Object.keys(e.owed).length
                        return (
                          <Row
                            key={e.id}
                            leading={<CategoryTile category={e.category} />}
                            title={e.description}
                            subtitle={`${youPaid ? 'You' : firstName(name(e.paidBy))} paid ${money(e.amountCents, group.currency)}${people > 1 ? ` · ${people} people` : ''}`}
                            end={
                              effect ? (
                                <RowEnd
                                  label={effect.label}
                                  amount={money(effect.cents, group.currency)}
                                  color={effect.tone === 'owed' ? colors.owed : effect.tone === 'owe' ? colors.owe : colors.muted}
                                />
                              ) : null
                            }
                            onPress={() => openExpense(router, { source: 'group', id: e.id, parentId: group.id, date: e.date })}
                          />
                        )
                      })}
                    </Rows>
                  </Card>
                </View>
              ))}
              {list.hasMore ? (
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

      {group ? (
        <Animated.View style={[styles.fab, { bottom: insets.bottom + 22 }, fab.style]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add expense to ${group.name}`}
            onPress={() => {
              tick()
              router.push({ pathname: '/add', params: { kind: 'group', id: group.id } })
            }}
            onPressIn={fab.onPressIn}
            onPressOut={fab.onPressOut}
            style={[styles.fabInner, { backgroundColor: colors.accent, shadowColor: colors.accentInk }]}
          >
            <Icons.plus color={colors.onAccent} size={24} />
            <Text weight={800} size={16} color={colors.onAccent}>
              Add expense
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}

      {group ? <GroupMenu open={menu} onClose={() => setMenu(false)} group={group} /> : null}
    </View>
  )
}

function joinNames(names: Array<string>) {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

type Group = NonNullable<FunctionReturnType<typeof api.groups.get>>

/** ⋯: the members, the balances, and archive or delete. */
function GroupMenu({ open, onClose, group }: { open: boolean; onClose: () => void; group: Group }) {
  const colors = useColors()
  const router = useRouter()
  const setArchived = useMutation(api.groups.setArchived)
  const remove = useMutation(api.groups.remove)
  const { run } = useRun()
  const id = group.id as Id<'groups'>

  async function archive() {
    onClose()
    await run(
      () => setArchived({ groupId: id, archived: !group.archived }),
      group.archived ? 'Group moved back to your list' : 'Group archived',
    )
  }

  async function del() {
    onClose()
    const ok = await confirm({
      title: `Delete “${group.name}”?`,
      body: 'Every expense and payment in it is deleted for everyone. This can’t be undone.',
      confirm: 'Delete',
      destructive: true,
    })
    if (!ok) return
    const done = await run(() => remove({ groupId: id }))
    if (done !== undefined) {
      toast(`Deleted ${group.name}`)
      router.back()
    }
  }

  return (
    <Sheet open={open} onClose={onClose} label="Group options">
      <SheetTitle kicker={group.name}>Members</SheetTitle>
      <View style={{ paddingVertical: 8 }}>
        <Rows inset={62}>
          {group.members.map((m) => (
            <Row
              key={m.id}
              minHeight={56}
              leading={<AvatarStack ring={colors.surface} people={[{ id: m.id, name: m.name, me: m.id === group.meMemberId }]} />}
              title={m.id === group.meMemberId ? 'You' : m.name}
              titleSize={15}
              subtitle={m.linked && m.id !== group.meMemberId ? 'On Settlr' : undefined}
              end={
                <RowEnd
                  label={m.netCents > 0 ? 'gets back' : m.netCents < 0 ? 'owes' : 'settled'}
                  amount={money(m.netCents, group.currency)}
                  color={m.netCents > 0 ? colors.owed : m.netCents < 0 ? colors.owe : colors.muted}
                />
              }
            />
          ))}
        </Rows>
      </View>
      <View style={[styles.menuActions, { borderTopColor: colors.divider }]}>
        <Row
          minHeight={56}
          leading={<Tile size={40} radius={13} icon={Icons.swap} iconSize={18} />}
          title="Balances and settle-up plan"
          titleSize={15}
          onPress={() => {
            onClose()
            router.push(`/groups/${group.id}/balances`)
          }}
        />
        {group.isOwner ? (
          <>
            <Row
              minHeight={56}
              leading={<Tile size={40} radius={13} icon={Icons.archive} iconSize={18} />}
              title={group.archived ? 'Unarchive group' : 'Archive group'}
              subtitle={group.archived ? undefined : 'Hides it from your list and totals'}
              titleSize={15}
              onPress={archive}
            />
            <Row
              minHeight={56}
              leading={<Tile size={40} radius={13} bg={colors.oweSoft} fg={colors.owe} icon={Icons.trash} iconSize={18} />}
              title="Delete group"
              titleColor={colors.owe}
              titleSize={15}
              onPress={del}
            />
          </>
        ) : null}
      </View>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gutter: { marginHorizontal: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingTop: 4 },
  headLoading: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingTop: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  balance: {
    marginTop: 20,
    marginHorizontal: 16,
    paddingVertical: 16,
    paddingLeft: 18,
    paddingRight: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  balanceLine: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 2 },
  budget: { marginTop: 10, marginHorizontal: 16, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 20 },
  budgetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  fab: { position: 'absolute', right: 16 },
  fabInner: {
    height: 58,
    paddingLeft: 18,
    paddingRight: 24,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowOpacity: 0.32,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  menuActions: { borderTopWidth: StyleSheet.hairlineWidth * 2, paddingTop: 6 },
})
