import { api } from '@settlr/backend/convex/_generated/api'
import type { Currency } from '@settlr/shared/schemas'
import { useQuery } from 'convex/react'
import { useRouter } from 'expo-router'
import { profileName } from '@settlr/shared/schemas'
import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'

import { Button, IconButton } from '@/components/button'
import { Field } from '@/components/controls'
import { Icons, type IconComponent } from '@/components/icons'
import { BalanceRowView, MonthItemRow, SettleNextCard } from '@/components/ledger'
import { Screen } from '@/components/screen'
import { Bar, Card, Rise, Row, RowEnd, Rows, Section, SkeletonRows } from '@/components/surfaces'
import { Sub, Text } from '@/components/text'
import { Avatar, Badge, CategoryTile, Tile } from '@/components/tiles'
import { balanceRows, mainCurrency, netByCurrency, totals } from '@/lib/balances'
import { firstName, localIsoDate, longDate, money, partOfDay, shortDate, signedMoney } from '@/lib/format'
import { useMe } from '@/lib/me'
import { errorText } from '@/lib/actions'
import { updateName } from '@/lib/auth-client'
import { usePrefs } from '@/lib/prefs'
import { cardShadow, useColors, useIsDark } from '@/theme'

export default function HomeScreen() {
  const colors = useColors()
  const router = useRouter()
  const me = useMe()
  const prefs = usePrefs()
  const today = localIsoDate()
  const month = today.slice(0, 7)

  const friends = useQuery(api.friends.list)
  const groups = useQuery(api.groups.list)
  const budgets = useQuery(api.budgets.list)
  const spending = useQuery(api.budgets.monthSpending, { month })
  const recent = useQuery(api.expenses.month, {
    month,
    q: '',
    category: 'all',
    source: 'all',
    sort: 'date',
    order: 'desc',
    limit: 5,
  })
  const unread = useQuery(api.notifications.unreadCount)
  const upcoming = useQuery(api.recurring.upcoming, { today, days: 14 })

  const rows = useMemo(() => (friends && groups ? balanceRows(friends, groups) : []), [friends, groups])
  const sums = useMemo(() => totals(rows), [rows])
  const main = mainCurrency(sums, spending?.[0]?.currency ?? groups?.[0]?.currency ?? prefs.currency)
  const nets = netByCurrency(sums)
  const loading = friends === undefined || groups === undefined

  // Settle next: what you owe first (biggest first), then what you’re owed.
  const next = [...rows.filter((r) => r.cents < 0), ...rows.filter((r) => r.cents > 0)].slice(0, 6)
  const firstRun = !loading && rows.length === 0 && friends.length === 0 && groups.length === 0

  return (
    <Screen tab>
      <View style={styles.header}>
        <View style={styles.grow}>
          <Sub>{longDate(today)}</Sub>
          <Text display weight={700} size={25} lineHeight={31} accessibilityRole="header" numberOfLines={1}>
            {partOfDay()}
            {me.name ? `, ${firstName(me.name)}` : ''}
          </Text>
        </View>
        <IconButton
          icon={Icons.bell}
          tone="filled"
          label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
          dot={Boolean(unread)}
          onPress={() => router.push('/notifications')}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Profile and settings" onPress={() => router.push('/profile')} hitSlop={6}>
          <Avatar name={me.name || me.email} me />
        </Pressable>
      </View>

      {me.loaded && !me.name ? <NameCard /> : null}

      <Rise index={1}>
        <AskBar hint={firstRun ? '“Dinner 1200 with Sam”' : '“Chai 40, personal”'} />
      </Rise>

      {firstRun ? (
        <FirstRun />
      ) : (
        <>
          <Rise index={2}>
            <Hero
              loading={loading}
              currency={main}
              net={nets[main] ?? 0}
              owed={sums.owed[main] ?? 0}
              owe={sums.owe[main] ?? 0}
              others={Object.entries(nets).filter(([c]) => c !== main) as Array<[Currency, number]>}
              open={rows.length}
            />
          </Rise>

          {next.length > 0 ? (
            <>
              <Section title="Settle next" action="Everyone" onAction={() => router.push('/friends')} />
              <Rise index={4}>
                <ScrollView horizontal style={{ flexGrow: 0 }} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nextRow}>
                  {next.map((row) => (
                    <SettleNextCard key={row.key} row={row} />
                  ))}
                </ScrollView>
              </Rise>
            </>
          ) : null}

          <Section title="Balances" action="See all" onAction={() => router.push('/groups')} />
          <Rise index={5} style={styles.gutter}>
            {loading ? (
              <SkeletonRows count={3} />
            ) : rows.length === 0 ? (
              <Card padded>
                <Row
                  minHeight={44}
                  style={{ paddingHorizontal: 0, paddingVertical: 0 }}
                  leading={<Tile size={40} bg={colors.owedSoft} fg={colors.owed} icon={Icons.check} />}
                  title="You're all square"
                  subtitle="Nobody owes anybody right now."
                />
              </Card>
            ) : (
              <Card>
                <Rows>
                  {rows.slice(0, 5).map((row) => (
                    <BalanceRowView key={row.key} row={row} />
                  ))}
                </Rows>
              </Card>
            )}
          </Rise>
        </>
      )}

      <Rise index={6}>
        <MonthShare
          month={month}
          today={today}
          spending={spending}
          budgets={budgets}
          fallback={main}
          onPress={() => router.push('/spending')}
        />
      </Rise>

      {upcoming && upcoming.length > 0 ? (
        <>
          <Section title="Upcoming bills" />
          <Rise index={7} style={styles.gutter}>
            <Card>
              <Rows inset={70}>
                {upcoming.slice(0, 3).map((bill) => (
                  <Row
                    key={bill.id}
                    minHeight={60}
                    leading={<CategoryTile category={bill.category} size={40} />}
                    title={bill.description}
                    titleSize={15}
                    subtitle={`${bill.frequency[0]!.toUpperCase()}${bill.frequency.slice(1)} · ${shortDate(bill.nextDate, today)}`}
                    end={<RowEnd amount={money(bill.amountCents, bill.currency)} />}
                  />
                ))}
              </Rows>
            </Card>
          </Rise>
        </>
      ) : null}

      {recent && recent.items.length > 0 ? (
        <>
          <Section title="Recent" action="All activity" onAction={() => router.push('/spending')} />
          <Rise index={8} style={styles.gutter}>
            <Card>
              <Rows>
                {recent.items.map((item) => (
                  <MonthItemRow key={item.key} item={item} today={today} />
                ))}
              </Rows>
            </Card>
          </Rise>
        </>
      ) : null}
    </Screen>
  )
}

/** A new account has no name yet: ask for it once, on Home. */
function NameCard() {
  const colors = useColors()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  async function save() {
    const parsed = profileName.safeParse({ name })
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Enter your name')
    setPending(true)
    try {
      await updateName(parsed.data.name)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setPending(false)
    }
  }
  return (
    <Rise index={0}>
      <View style={[styles.nameCard, { backgroundColor: colors.accentSoft }]}>
        <Text accessibilityRole="header" weight={800} size={15.5}>
          What should we call you?
        </Text>
        <Sub style={{ marginTop: 2 }}>Friends and groups see this name.</Sub>
        <View style={styles.nameRow}>
          <Field
            style={styles.grow}
            value={name}
            onChangeText={(t) => {
              setName(t)
              setError(null)
            }}
            placeholder="Your full name"
            accessibilityLabel="Your name"
            autoCapitalize="words"
            onSubmitEditing={save}
            error={error}
          />
          <Button size="md" onPress={save} loading={pending} style={{ marginTop: 8 }}>
            Save
          </Button>
        </View>
      </View>
    </Rise>
  )
}

/** "Ask or add…": opens the assistant. */
function AskBar({ hint }: { hint: string }) {
  const colors = useColors()
  const isDark = useIsDark()
  const router = useRouter()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ask the assistant or add an expense"
      onPress={() => router.push('/assistant')}
      style={({ pressed }) => [
        styles.ask,
        { backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1 },
        cardShadow(isDark),
      ]}
    >
      <Icons.spark color={colors.accent} size={22} />
      <Text weight={600} size={15} color="faint" numberOfLines={1} style={styles.grow}>
        Ask or add… {hint}
      </Text>
      <View style={[styles.mic, { backgroundColor: colors.surface2 }]}>
        <Icons.mic color={colors.text} size={18} />
      </View>
    </Pressable>
  )
}

/** The violet card: where you stand overall, in the main currency. */
function Hero({
  loading,
  currency,
  net,
  owed,
  owe,
  others,
  open,
}: {
  loading: boolean
  currency: Currency
  net: number
  owed: number
  owe: number
  others: Array<[Currency, number]>
  open: number
}) {
  const colors = useColors()
  const heading = loading ? 'Overall' : net > 0 ? 'Overall, you’re owed' : net < 0 ? 'Overall, you owe' : 'Overall, you’re square'
  return (
    <View style={[styles.hero, { backgroundColor: colors.hero }]}>
      <View style={styles.heroTop}>
        <Text weight={600} size={14} color={colors.heroDim}>
          {heading}
        </Text>
        {open > 0 ? (
          <Badge bg={colors.heroTile} fg={colors.onHero}>
            {open === 1 ? '1 open balance' : `${open} open balances`}
          </Badge>
        ) : null}
      </View>
      <Text
        display
        weight={800}
        size={58}
        lineHeight={64}
        tracking={-0.045}
        tabular
        color={colors.onHero}
        adjustsFontSizeToFit
        numberOfLines={1}
        accessibilityLabel={`${heading} ${money(net, currency)}`}
      >
        {loading ? '—' : money(net, currency)}
      </Text>
      {others.length > 0 ? (
        <Text weight={600} size={13} color={colors.heroDim}>
          and {others.map(([c, cents]) => signedMoney(cents, c)).join(', ')} in other currencies
        </Text>
      ) : null}
      <View style={styles.heroTiles}>
        <HeroTile icon={Icons.in} label="Owed to you" value={money(owed, currency)} />
        <HeroTile icon={Icons.out} label="You owe" value={money(owe, currency)} />
      </View>
    </View>
  )
}

function HeroTile({ icon: Icon, label, value }: { icon: IconComponent; label: string; value: string }) {
  const colors = useColors()
  return (
    <View style={[styles.heroTile, { backgroundColor: colors.heroTile }]}>
      <View style={styles.heroTileHead}>
        <Icon color={colors.heroDim} size={15} />
        <Text weight={600} size={13} color={colors.heroDim}>
          {label}
        </Text>
      </View>
      <Text weight={800} size={19} lineHeight={25} tabular color={colors.onHero} style={{ marginTop: 2 }}>
        {value}
      </Text>
    </View>
  )
}

type Spending = Array<{ currency: Currency; total: number; personal: number; friends: number; groups: number }>
type Budget = { currency: Currency; amountCents: number }

/** "Your share in November" with the budget bar. */
function MonthShare({
  month,
  today,
  spending,
  budgets,
  fallback,
  onPress,
}: {
  month: string
  today: string
  spending: Spending | undefined
  budgets: Array<Budget> | undefined
  fallback: Currency
  onPress: () => void
}) {
  const colors = useColors()
  if (!spending || !budgets) return null
  const budget = budgets.find((b) => spending.some((s) => s.currency === b.currency)) ?? budgets[0]
  const currency = budget?.currency ?? spending[0]?.currency ?? fallback
  const spent = spending.find((s) => s.currency === currency)?.total ?? 0
  const monthName = new Date(`${month}-01T00:00:00Z`).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })
  const daysInMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()
  const daysLeft = daysInMonth - Number(today.slice(8, 10)) + 1
  const left = budget ? budget.amountCents - spent : 0
  return (
    <Card onPress={onPress} accessibilityLabel="Your spending this month" style={[styles.gutter, styles.share]}>
      <View style={styles.shareHead}>
        <Text weight={700} size={15}>
          Your share in {monthName}
        </Text>
        <Text weight={800} size={18} tabular>
          {money(spent, currency)}
        </Text>
      </View>
      {budget ? (
        <>
          <View style={{ marginTop: 12 }}>
            <Bar value={spent / budget.amountCents} color={left < 0 ? colors.owe : colors.accent} />
          </View>
          <Sub style={{ marginTop: 10 }}>
            {left >= 0
              ? `${money(left, currency)} left of your ${money(budget.amountCents, currency)} budget · ${money(Math.floor(left / daysLeft), currency)} a day`
              : `${money(-left, currency)} over your ${money(budget.amountCents, currency)} budget`}
          </Sub>
        </>
      ) : (
        <Sub style={{ marginTop: 6 }}>Personal spending plus your share with friends and groups. Set a budget in Spending.</Sub>
      )}
    </Card>
  )
}

/** Home before there's anything to show: three ways to start. */
function FirstRun() {
  const colors = useColors()
  const router = useRouter()
  const steps = [
    { icon: Icons.users, hue: 'violet' as const, title: 'Start a group', sub: 'For a trip, a flat or a dinner. Up to 20 people, no accounts needed.', href: '/groups/new' as const },
    { icon: Icons.userPlus, hue: 'blue' as const, title: 'Add a friend', sub: 'Keep a one-on-one ledger. Add their email to share it.', href: '/friends/new' as const },
    { icon: Icons.wallet, hue: 'amber' as const, title: 'Log something just for you', sub: 'Personal spending counts toward your monthly budget.', href: '/add' as const },
  ]
  return (
    <>
      <Rise index={2}>
        <View style={[styles.hero, styles.heroEmpty, { backgroundColor: colors.hero }]}>
          <View style={[styles.heroCheck, { backgroundColor: colors.heroTile }]}>
            <Icons.check color={colors.onHero} size={26} />
          </View>
          <Text display weight={800} size={30} lineHeight={36} color={colors.onHero} align="center" style={{ marginTop: 12 }}>
            You're all square
          </Text>
          <Text weight={600} size={14} color={colors.heroDim} align="center" style={{ marginTop: 4 }}>
            Nobody owes anybody. Let's change that.
          </Text>
        </View>
      </Rise>
      <Section title="Get started" />
      <View style={[styles.gutter, { gap: 10 }]}>
        {steps.map((step, i) => (
          <Rise key={step.title} index={3 + i}>
            <Card onPress={() => router.push(step.href)} accessibilityLabel={step.title}>
              <Row
                leading={<Tile hue={step.hue} size={50} radius={17} icon={step.icon} iconSize={24} />}
                title={step.title}
                subtitle={step.sub}
                wrap
                end={<Icons.chevR color={colors.faint} size={18} />}
                style={{ paddingVertical: 16 }}
              />
            </Card>
          </Rise>
        ))}
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  gutter: { marginHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 64, paddingLeft: 20, paddingRight: 16 },
  ask: {
    marginTop: 10,
    marginHorizontal: 16,
    height: 54,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 18,
    paddingRight: 7,
  },
  mic: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  hero: { marginTop: 16, marginHorizontal: 16, paddingTop: 20, paddingHorizontal: 20, paddingBottom: 18, borderRadius: 28 },
  heroEmpty: { alignItems: 'center', paddingVertical: 22 },
  heroCheck: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  heroTiles: { flexDirection: 'row', gap: 8, marginTop: 16 },
  heroTile: { flex: 1, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 18 },
  heroTileHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nextRow: { gap: 10, paddingHorizontal: 16, paddingBottom: 14, paddingTop: 2 },
  share: { marginTop: 16, padding: 18, paddingBottom: 16 },
  nameCard: { marginTop: 10, marginHorizontal: 16, padding: 16, borderRadius: 24 },
  nameRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 10 },
  shareHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
})

