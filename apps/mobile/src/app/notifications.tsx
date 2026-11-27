import { api } from '@settlr/backend/convex/_generated/api'
import type { Currency } from '@settlr/shared/schemas'
import { useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { useRouter } from 'expo-router'
import { useEffect, useRef } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

import { Button } from '@/components/button'
import { Chip } from '@/components/controls'
import { Icons, type IconComponent } from '@/components/icons'
import { pressedStyle, ripple } from '@/components/ripple'
import { Screen, TopBar } from '@/components/screen'
import { Card, DayHeading, Empty, Rise, Rows, SkeletonRows } from '@/components/surfaces'
import { Sub, Text, Title } from '@/components/text'
import { Avatar, Tile } from '@/components/tiles'
import { useRun } from '@/lib/actions'
import { addDays, firstName, localIsoDate, money, signedMoney, timeAgo } from '@/lib/format'
import { useColors, type Colors } from '@/theme'

type Item = FunctionReturnType<typeof api.notifications.list>['items'][number]

export default function NotificationsScreen() {
  const colors = useColors()
  const data = useQuery(api.notifications.list, { limit: 50 })
  const markAllRead = useMutation(api.notifications.markAllRead)
  const accept = useMutation(api.notifications.acceptRequest)
  const decline = useMutation(api.notifications.declineRequest)
  const { run } = useRun()
  const today = localIsoDate()
  const yesterday = addDays(today, -1)

  // Leaving the page counts as reading everything on it.
  const hasUnread = useRef(false)
  hasUnread.current = Boolean(data?.items.some((i) => !i.read))
  useEffect(() => () => {
    if (hasUnread.current) markAllRead().catch(() => {})
  }, [markAllRead])

  const sections: Array<{ title: string; items: Array<Item> }> = []
  for (const item of data?.items ?? []) {
    const day = localIsoDate(new Date(item.createdAt))
    const title = day === today ? 'Today' : day === yesterday ? 'Yesterday' : 'Earlier'
    const last = sections[sections.length - 1]
    if (last?.title === title) last.items.push(item)
    else sections.push({ title, items: [item] })
  }

  return (
    <Screen>
      <TopBar
        actions={
          data?.items.some((i) => !i.read) ? (
            <Chip
              tone="line"
              icon={Icons.check}
              style={{ marginRight: 4 }}
              onPress={() => run(() => markAllRead())}
            >
              Mark all read
            </Chip>
          ) : null
        }
      />
      <Title style={{ paddingHorizontal: 20 }}>Notifications</Title>

      {data?.requests.map((r, i) => (
        <Rise key={r.id} index={1 + i}>
          <View style={[styles.request, { backgroundColor: colors.accentSoft }]}>
            <View style={styles.row}>
              <Avatar name={r.fromName} />
              <View style={styles.grow}>
                <Text weight={700} size={15}>
                  {r.fromName}
                </Text>
                <Text weight={500} size={13} color="accentInk">
                  wants to share a ledger with you
                </Text>
              </View>
            </View>
            <Sub style={{ marginTop: 10 }}>Accepting links your ledgers, so you both see the same expenses and payments.</Sub>
            <View style={styles.buttons}>
              <Button size="md" style={styles.grow} onPress={() => run(() => accept({ requestId: r.id }), `You and ${firstName(r.fromName)} share a ledger now`)}>
                Accept
              </Button>
              <Button size="md" style={styles.grow} colors={{ bg: colors.surface, fg: colors.text }} onPress={() => run(() => decline({ requestId: r.id }), 'Request declined')}>
                Decline
              </Button>
            </View>
          </View>
        </Rise>
      ))}

      {data === undefined ? (
        <View style={{ marginHorizontal: 16, marginTop: 18 }}>
          <SkeletonRows count={4} />
        </View>
      ) : data.items.length === 0 && data.requests.length === 0 ? (
        <Card style={{ marginHorizontal: 16, marginTop: 18 }}>
          <Empty icon={Icons.bell} title="Nothing yet" hint="When friends add expenses with you or pay you back, you'll see it here." />
        </Card>
      ) : (
        sections.map((section, i) => (
          <Rise key={section.title} index={2 + i} style={{ marginTop: i === 0 ? 10 : 0 }}>
            <DayHeading>{section.title}</DayHeading>
            <Card style={{ marginHorizontal: 16 }}>
              <Rows>
                {section.items.map((item) => (
                  <NotificationRow key={item.id} item={item} />
                ))}
              </Rows>
            </Card>
          </Rise>
        ))
      )}
    </Screen>
  )
}

/** What a notification says and the little badge on its avatar. */
function describe(item: Item, colors: Colors): { text: Array<[string, boolean]>; sub: string; icon: IconComponent; bg: string; fg: string; amountColor?: string; amount?: string } {
  const actor = firstName(item.actorName)
  const where = item.groupName ? ` in ${item.groupName}` : ''
  const c = (item.currency ?? 'INR') as Currency
  const cents = item.amountCents ?? 0
  const share = item.amountCents !== undefined ? signedMoney(cents, c) : undefined
  const tone = cents > 0 ? colors.owed : cents < 0 ? colors.owe : colors.text
  switch (item.kind) {
    case 'friend_expense':
    case 'group_expense':
      return {
        text: [[actor, true], [' added ', false], [item.description ?? 'an expense', true], [where, false]],
        sub: cents > 0 ? 'you lent' : 'your share',
        icon: Icons.receipt,
        bg: colors.hues.blue.bg,
        fg: colors.hues.blue.fg,
        amount: item.amountCents !== undefined ? money(cents, c) : undefined,
        amountColor: tone,
      }
    case 'friend_entry_updated':
    case 'group_expense_updated':
      return {
        text: [[actor, true], [' edited ', false], [item.description ?? 'an expense', true], [where, false]],
        sub: 'now',
        icon: Icons.pen,
        bg: colors.surface2,
        fg: colors.muted,
        amount: share,
        amountColor: tone,
      }
    case 'friend_payment':
      return {
        text: [[actor, true], [' recorded a payment', false]],
        sub: cents > 0 ? 'received' : 'paid',
        icon: Icons.in,
        bg: colors.owedSoft,
        fg: colors.owed,
        amount: item.amountCents !== undefined ? money(cents, c) : undefined,
        amountColor: colors.owed,
      }
    case 'group_payment':
      return {
        text: [[item.description ?? `${actor} recorded a payment`, false], [where, false]],
        sub: '',
        icon: Icons.swap,
        bg: colors.owedSoft,
        fg: colors.owed,
        amount: item.amountCents !== undefined ? money(cents, c) : undefined,
      }
    case 'reminder':
      return {
        text: [[actor, true], [' sent you a reminder', false]],
        sub: 'you owe',
        icon: Icons.bellRing,
        bg: colors.oweSoft,
        fg: colors.owe,
        amount: item.amountCents !== undefined ? money(cents, c) : undefined,
        amountColor: colors.owe,
      }
    case 'payment_confirmed':
      return {
        text: [[actor, true], [' confirmed your payment', false], [where, false]],
        sub: '',
        icon: Icons.check,
        bg: colors.owedSoft,
        fg: colors.owed,
        amount: item.amountCents !== undefined ? money(cents, c) : undefined,
      }
    case 'payment_rejected':
      return {
        text: [[actor, true], [' said they didn’t get your payment', false], [where, false]],
        sub: 'removed',
        icon: Icons.alert,
        bg: colors.warnSoft,
        fg: colors.warn,
        amount: item.amountCents !== undefined ? money(cents, c) : undefined,
      }
    case 'comment':
      return {
        text: [[actor, true], [' commented', false], [where, false]],
        sub: item.description ?? '',
        icon: Icons.msg,
        bg: colors.hues.blue.bg,
        fg: colors.hues.blue.fg,
      }
    case 'group_added':
      return { text: [[actor, true], [' added you to ', false], [item.groupName ?? 'a group', true]], sub: '', icon: Icons.users, bg: colors.accentSoft, fg: colors.accentInk }
    case 'group_joined':
      return { text: [[actor, true], [' joined ', false], [item.groupName ?? 'your group', true], [' through your invite link', false]], sub: '', icon: Icons.userPlus, bg: colors.accentSoft, fg: colors.accentInk }
    case 'request_accepted':
      return { text: [[actor, true], [' accepted your friend request', false]], sub: 'your ledgers are shared now', icon: Icons.check, bg: colors.accentSoft, fg: colors.accentInk }
  }
}

function NotificationRow({ item }: { item: Item }) {
  const colors = useColors()
  const router = useRouter()
  const d = describe(item, colors)
  const href = item.groupId ? (`/groups/${item.groupId}` as const) : item.friendId ? (`/friends/${item.friendId}` as const) : null
  return (
    <Pressable
      accessibilityRole={href ? 'button' : undefined}
      disabled={!href}
      onPress={() => href && router.push(href)}
      android_ripple={href ? ripple(colors.text, { strength: 0.1 }) : undefined}
      style={({ pressed }) => [styles.item, pressedStyle(pressed)]}
    >
      <View>
        <Avatar name={item.actorName} />
        <Tile size={22} radius={8} bg={d.bg} fg={d.fg} icon={d.icon} iconSize={12} style={[styles.kind, { borderColor: colors.surface }]} />
      </View>
      <View style={styles.grow}>
        <Text weight={500} size={14.5} lineHeight={20}>
          {d.text.map(([t, bold], i) => (
            <Text key={i} weight={bold ? 800 : 500} size={14.5}>
              {t}
            </Text>
          ))}
        </Text>
        <Sub style={{ marginTop: 2 }} numberOfLines={2}>
          {timeAgo(item.createdAt)}
          {d.sub ? ` · ${d.sub}` : ''}
          {d.amount ? ' ' : ''}
          {d.amount ? (
            <Text weight={800} size={13} tabular color={d.amountColor ?? colors.text}>
              {d.amount}
            </Text>
          ) : null}
        </Sub>
        {item.kind === 'reminder' && item.friendId ? (
          <Button
            size="sm"
            variant="contrast"
            icon={Icons.swap}
            style={{ marginTop: 10, alignSelf: 'flex-start' }}
            onPress={() => router.push({ pathname: '/settle', params: { kind: 'friend', id: item.friendId!, currency: item.currency ?? '' } })}
          >
            Settle up
          </Button>
        ) : null}
      </View>
      {!item.read ? <View style={[styles.dot, { backgroundColor: colors.accent }]} accessibilityLabel="Unread" /> : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  request: { marginTop: 18, marginHorizontal: 16, padding: 16, borderRadius: 24 },
  buttons: { flexDirection: 'row', gap: 8, marginTop: 12 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 12, paddingHorizontal: 16, minHeight: 68 },
  kind: { position: 'absolute', right: -4, bottom: -4, borderWidth: 2.5 },
  dot: { width: 9, height: 9, borderRadius: 5, marginTop: 6 },
})
