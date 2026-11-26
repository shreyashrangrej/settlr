import type { Category, Currency } from '@settlr/shared/schemas'
import { useRouter } from 'expo-router'
import { StyleSheet, View } from 'react-native'

import { Button } from '@/components/button'
import { Icons } from '@/components/icons'
import { Row, RowEnd } from '@/components/surfaces'
import { Label, Sub, Text } from '@/components/text'
import { Avatar, Badge, CategoryTile, GroupTile, Tile } from '@/components/tiles'
import { stanceLabel, type BalanceRow } from '@/lib/balances'
import { money, shortDate } from '@/lib/format'
import { cardShadow, useColors, useIsDark } from '@/theme'

/** An expense from `expenses.month`: what it is, where, and what it meant for you. */
export type MonthItem = {
  key: string
  source: 'group' | 'friend' | 'personal'
  id: string
  description: string
  category: Category
  date: string
  currency: Currency
  amountCents: number
  shareCents: number
  paidBy: string
  where: { id: string; name: string } | null
  hasReceipt: boolean
  tags: Array<string>
}

export function openExpense(
  router: ReturnType<typeof useRouter>,
  item: { source: 'group' | 'friend' | 'personal'; id: string; parentId?: string | null; date: string },
) {
  router.push({
    pathname: '/expense',
    params: { kind: item.source, id: item.id, parent: item.parentId ?? '', date: item.date },
  })
}

/**
 * Lent or borrowed: what an expense did to your balance. You paid → you
 * lent everyone else's share; someone else paid → you borrowed yours.
 */
export function effectOf(paidByYou: boolean, amountCents: number, shareCents: number) {
  if (paidByYou) {
    const lent = amountCents - shareCents
    return lent > 0 ? { label: 'you lent', cents: lent, tone: 'owed' as const } : null
  }
  return shareCents > 0 ? { label: 'you borrowed', cents: shareCents, tone: 'owe' as const } : { label: 'not involved', cents: 0, tone: null }
}

/** A row in Home's Recent list or Spending's month list. */
export function MonthItemRow({ item, today, mode = 'effect' }: { item: MonthItem; today: string; mode?: 'effect' | 'share' }) {
  const colors = useColors()
  const router = useRouter()
  const paidByYou = item.paidBy === 'You'
  const where = item.where?.name ?? 'Personal'
  const sub =
    item.source === 'personal'
      ? `Personal · ${shortDate(item.date, today)}`
      : `${where} · ${paidByYou ? 'you' : item.paidBy} paid ${money(item.amountCents, item.currency)}`
  let end
  if (mode === 'share' || item.source === 'personal') {
    end = (
      <RowEnd
        amount={money(item.shareCents, item.currency)}
        sub={item.source === 'personal' || item.shareCents === item.amountCents ? undefined : `of ${money(item.amountCents, item.currency)}`}
      />
    )
  } else {
    const effect = effectOf(paidByYou, item.amountCents, item.shareCents)
    end = effect ? (
      <RowEnd
        label={effect.label}
        amount={money(effect.cents, item.currency)}
        color={effect.tone === 'owed' ? colors.owed : effect.tone === 'owe' ? colors.owe : undefined}
      />
    ) : (
      <RowEnd label="your share" amount={money(item.shareCents, item.currency)} />
    )
  }
  return (
    <Row
      leading={<CategoryTile category={item.category} />}
      title={item.description}
      subtitle={sub}
      end={end}
      onPress={() => openExpense(router, { source: item.source, id: item.id, parentId: item.where?.id, date: item.date })}
    />
  )
}

/** A friend or group you aren't square with, as a row. */
export function BalanceRowView({ row }: { row: BalanceRow }) {
  const colors = useColors()
  const router = useRouter()
  return (
    <Row
      leading={row.kind === 'group' ? <GroupTile id={row.id} name={row.name} /> : <Avatar id={row.id} name={row.name} />}
      title={row.name}
      subtitle={row.kind === 'group' ? `Group · ${row.memberCount} people` : 'Friend'}
      end={
        <RowEnd
          label={stanceLabel(row.cents, row.kind)}
          amount={money(row.cents, row.currency)}
          color={row.cents > 0 ? colors.owed : colors.owe}
        />
      }
      onPress={() => router.push(row.kind === 'group' ? `/groups/${row.id}` : `/friends/${row.id}`)}
    />
  )
}

/** Where to record paying off a balance: the settle sheet, or the group's plan. */
export function settleHref(row: BalanceRow) {
  if (row.kind === 'group') return `/groups/${row.id}/balances` as const
  return { pathname: '/settle' as const, params: { kind: 'friend', id: row.id, currency: row.currency } }
}

/** Home's "Settle next" card: who, how much, and the button to settle it. */
export function SettleNextCard({ row }: { row: BalanceRow }) {
  const colors = useColors()
  const isDark = useIsDark()
  const router = useRouter()
  const owe = row.cents < 0
  const label = row.kind === 'group' ? (owe ? 'you owe' : 'you’re owed') : owe ? 'you owe' : 'owes you'
  return (
    <View style={[styles.next, { backgroundColor: colors.surface }, cardShadow(isDark)]}>
      <View style={styles.nextHead}>
        {row.kind === 'group' ? (
          <GroupTile id={row.id} name={row.name} size={32} radius={11} />
        ) : (
          <Avatar id={row.id} name={row.name} size="sm" />
        )}
        <Text weight={700} size={14.5} numberOfLines={1} style={styles.grow}>
          {row.name}
        </Text>
      </View>
      <View>
        <Label>{label}</Label>
        <Text weight={800} size={20} lineHeight={26} tabular color={owe ? colors.owe : colors.owed}>
          {money(row.cents, row.currency)}
        </Text>
      </View>
      <Button
        size="sm"
        variant={owe ? 'contrast' : 'green'}
        onPress={() => router.push(settleHref(row))}
        accessibilityLabel={`${owe ? 'Settle up with' : 'Record payment from'} ${row.name}`}
      >
        {owe ? 'Settle up' : 'Record payment'}
      </Button>
    </View>
  )
}

/** "settled" / "owes you ₹2,140" as a right-hand badge or amount for a friend. */
export function FriendBalanceEnd({ balances }: { balances: Record<string, number> }) {
  const colors = useColors()
  const open = Object.entries(balances).filter(([, c]) => c !== 0) as Array<[Currency, number]>
  if (open.length === 0) {
    return (
      <Badge icon={Icons.check} tone="neutral">
        settled
      </Badge>
    )
  }
  const [currency, cents] = open.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0]!
  return (
    <RowEnd
      label={cents > 0 ? 'owes you' : 'you owe'}
      amount={money(cents, currency)}
      color={cents > 0 ? colors.owed : colors.owe}
      sub={open.length > 1 ? `+${open.length - 1} more` : undefined}
    />
  )
}

/** A payment row: who paid whom. */
export function PaymentTile({ incoming }: { incoming: boolean }) {
  const colors = useColors()
  return (
    <Tile
      bg={incoming ? colors.owedSoft : colors.surface2}
      fg={incoming ? colors.owed : colors.muted}
      icon={incoming ? Icons.in : Icons.out}
    />
  )
}

export function Muted({ children }: { children: string }) {
  return <Sub>{children}</Sub>
}

const styles = StyleSheet.create({
  next: { width: 176, padding: 14, borderRadius: 22, gap: 10 },
  nextHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  grow: { flex: 1, minWidth: 0 },
})
