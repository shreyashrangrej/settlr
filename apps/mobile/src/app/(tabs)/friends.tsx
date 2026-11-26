import { api } from '@settlr/backend/convex/_generated/api'
import type { Currency } from '@settlr/shared/schemas'
import { useMutation, useQuery } from 'convex/react'
import { useRouter } from 'expo-router'
import { StyleSheet, View } from 'react-native'

import { Button, IconButton } from '@/components/button'
import { Icons, type IconComponent } from '@/components/icons'
import { FriendBalanceEnd } from '@/components/ledger'
import { Screen, TabHeader } from '@/components/screen'
import { Card, Empty, Rise, Row, Rows, Section, SkeletonRows } from '@/components/surfaces'
import { Label, Sub, Text } from '@/components/text'
import { Avatar, Badge } from '@/components/tiles'
import { useRun } from '@/lib/actions'
import { totals, type FriendSummary } from '@/lib/balances'
import { money, timeAgo } from '@/lib/format'
import { usePrefs } from '@/lib/prefs'
import { useColors } from '@/theme'

export default function FriendsScreen() {
  const router = useRouter()
  const friends = useQuery(api.friends.list)
  const inbox = useQuery(api.notifications.list, { limit: 10 })
  const accept = useMutation(api.notifications.acceptRequest)
  const { run } = useRun()

  const open = (friends ?? []).filter((f) => Object.values(f.balances).some((c) => c !== 0))
  const square = (friends ?? []).filter((f) => !Object.values(f.balances).some((c) => c !== 0))
  const rows = open.flatMap((f) =>
    Object.entries(f.balances).map(([currency, cents]) => ({ currency: currency as Currency, cents })),
  )
  const sums = totals(rows)

  return (
    <Screen tab>
      <TabHeader
        title="Friends"
        actions={<IconButton icon={Icons.userPlus} tone="filled" label="Add a friend" onPress={() => router.push('/friends/new')} />}
      />

      {friends && friends.length > 0 ? (
        <Rise index={1} style={styles.totals}>
          <TotalCard icon={Icons.in} label="Owe you" amounts={sums.owed} tone="owed" count={open.filter((f) => Object.values(f.balances).some((c) => c > 0)).length} />
          <TotalCard icon={Icons.out} label="You owe" amounts={sums.owe} tone="owe" count={open.filter((f) => Object.values(f.balances).some((c) => c < 0)).length} />
        </Rise>
      ) : null}

      {inbox?.requests.map((r) => (
        <Rise index={2} key={r.id}>
          <Request
            name={r.fromName}
            onAccept={() => run(() => accept({ requestId: r.id }), `You and ${r.fromName} share a ledger now`)}
          />
        </Rise>
      ))}

      {friends === undefined ? (
        <View style={[styles.gutter, { marginTop: 20 }]}>
          <SkeletonRows count={4} />
        </View>
      ) : friends.length === 0 ? (
        <Card style={[styles.gutter, { marginTop: 12 }]}>
          <Empty
            icon={Icons.userPlus}
            title="No friends yet"
            hint="Keep a one-on-one ledger. Add their email to share it with them."
            action="Add a friend"
            onAction={() => router.push('/friends/new')}
          />
        </Card>
      ) : (
        <>
          {open.length > 0 ? (
            <>
              <Section title="Open balances" />
              <Rise index={3}>
                <Card style={styles.gutter}>
                  <Rows>
                    {open.map((f) => (
                      <FriendRow key={f.id} friend={f} />
                    ))}
                  </Rows>
                </Card>
              </Rise>
            </>
          ) : null}
          {square.length > 0 ? (
            <>
              <Section title="Settled up" />
              <Rise index={4}>
                <Card style={styles.gutter}>
                  <Rows>
                    {square.map((f) => (
                      <FriendRow key={f.id} friend={f} />
                    ))}
                  </Rows>
                </Card>
              </Rise>
            </>
          ) : null}
        </>
      )}
    </Screen>
  )
}

function FriendRow({ friend }: { friend: FriendSummary }) {
  const colors = useColors()
  const router = useRouter()
  const settled = !Object.values(friend.balances).some((c) => c !== 0)
  return (
    <Row
      leading={<Avatar id={friend.id} name={friend.name} />}
      title={
        <View style={styles.nameRow}>
          <Text weight={700} size={15.5} lineHeight={21} numberOfLines={1} style={{ flexShrink: 1 }}>
            {friend.name}
          </Text>
          {friend.status === 'linked' ? <Icons.verified color={colors.accent} size={15} /> : null}
        </View>
      }
      subtitle={
        friend.status === 'pending' && settled
          ? 'Friend request sent'
          : `Last activity ${timeAgo(friend.lastActivityAt)}`
      }
      end={
        settled && friend.status === 'pending' ? (
          <Badge tone="warn" icon={Icons.clock}>
            request sent
          </Badge>
        ) : (
          <FriendBalanceEnd balances={friend.balances} />
        )
      }
      onPress={() => router.push(`/friends/${friend.id}`)}
    />
  )
}

function TotalCard({
  icon: Icon,
  label,
  amounts,
  tone,
  count,
}: {
  icon: IconComponent
  label: string
  amounts: Partial<Record<Currency, number>>
  tone: 'owed' | 'owe'
  count: number
}) {
  const colors = useColors()
  const prefs = usePrefs()
  const entries = (Object.entries(amounts) as Array<[Currency, number]>).sort((a, b) => b[1] - a[1])
  const [first, ...rest] = entries
  const color = tone === 'owed' ? colors.owed : colors.owe
  return (
    <Card style={styles.total}>
      <View style={styles.nameRow}>
        <Icon color={color} size={15} />
        <Label>{label}</Label>
      </View>
      <Text weight={800} size={19} lineHeight={26} tabular color={color} style={{ marginTop: 2 }}>
        {money(first?.[1] ?? 0, first?.[0] ?? prefs.currency)}
      </Text>
      <Sub weight={700}>
        {rest.length > 0
          ? rest.map(([c, cents]) => `+ ${money(cents, c)}`).join(' ')
          : count === 0
            ? 'nobody'
            : count === 1
              ? (tone === 'owed' ? 'from 1 friend' : 'to 1 friend')
              : (tone === 'owed' ? `from ${count} friends` : `to ${count} friends`)}
      </Sub>
    </Card>
  )
}

function Request({ name, onAccept }: { name: string; onAccept: () => void }) {
  const colors = useColors()
  const router = useRouter()
  return (
    <View style={[styles.request, { backgroundColor: colors.accentSoft }]}>
      <Avatar name={name} />
      <View style={styles.grow}>
        <Text weight={700} size={15} numberOfLines={1}>
          {name}
        </Text>
        <Text weight={500} size={13} color="accentInk">
          wants to share a ledger with you
        </Text>
      </View>
      <Button size="sm" onPress={onAccept}>
        Accept
      </Button>
      <IconButton icon={Icons.chevR} label="See the request" size={34} iconSize={18} onPress={() => router.push('/notifications')} />
    </View>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  gutter: { marginHorizontal: 16 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  totals: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 8 },
  total: { flex: 1, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 22 },
  request: {
    marginTop: 14,
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
})
