import { api } from '@settlr/backend/convex/_generated/api'
import { categoryLabel, shiftMonth } from '@settlr/shared/format'
import type { Category, Currency } from '@settlr/shared/schemas'
import { useQuery } from 'convex/react'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { Button, IconButton } from '@/components/button'
import { Chip, ChipRow, Segmented } from '@/components/controls'
import { Icons } from '@/components/icons'
import { MonthItemRow } from '@/components/ledger'
import { Ring } from '@/components/ring'
import { Screen, TabHeader } from '@/components/screen'
import { Bar, Card, Empty, Rise, Row, Rows, Section, SkeletonRows } from '@/components/surfaces'
import { Label, Sub, Text } from '@/components/text'
import { CategoryTile } from '@/components/tiles'
import { CATEGORY_HUE } from '@/lib/category'
import { localIsoDate, money, monthName } from '@/lib/format'
import { usePrefs } from '@/lib/prefs'
import { cardShadow, useColors, useIsDark } from '@/theme'

const PAGE = 30

export default function SpendingScreen() {
  const colors = useColors()
  const isDark = useIsDark()
  const router = useRouter()
  const prefs = usePrefs()
  const today = localIsoDate()
  const thisMonth = today.slice(0, 7)
  const [month, setMonth] = useState(thisMonth)
  const [source, setSource] = useState<'all' | 'personal'>('all')
  const [tag, setTag] = useState<string | null>(null)
  const [limit, setLimit] = useState(PAGE)
  const [picked, setPicked] = useState<Currency | null>(null)

  const spending = useQuery(api.budgets.monthSpending, { month })
  const budgets = useQuery(api.budgets.list)
  const list = useQuery(api.expenses.month, {
    month,
    q: '',
    category: 'all',
    source,
    sort: 'date',
    order: 'desc',
    limit,
    ...(tag ? { tag } : {}),
  })

  const currencies = (spending ?? []).map((s) => s.currency)
  const budgetCurrency = budgets?.find((b) => currencies.includes(b.currency))?.currency ?? budgets?.[0]?.currency
  const currency: Currency = picked && currencies.includes(picked) ? picked : (budgetCurrency ?? currencies[0] ?? prefs.currency)
  const row = spending?.find((s) => s.currency === currency)
  const budget = budgets?.find((b) => b.currency === currency)
  const total = source === 'personal' ? (row?.personal ?? 0) : (row?.total ?? 0)
  const daysInMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()
  const daysLeft = month === thisMonth ? daysInMonth - Number(today.slice(8, 10)) + 1 : 0
  const left = budget ? budget.amountCents - (row?.total ?? 0) : 0

  // By category: the month's share in this currency (personal only when filtered).
  const categories = (
    source === 'personal'
      ? (list?.byCategory ?? []).filter((c) => c.currency === currency).map((c) => [c.category, c.cents] as const)
      : (Object.entries(row?.byCategory ?? {}) as Array<[Category, number]>)
  )
    .filter(([, cents]) => cents > 0)
    .sort((a, b) => b[1] - a[1])
  const biggest = categories[0]?.[1] ?? 1

  function go(delta: number) {
    setMonth((m) => shiftMonth(m, delta))
    setLimit(PAGE)
    setTag(null)
  }

  return (
    <Screen tab>
      <TabHeader title="Spending" />
      <Rise index={1} style={styles.controls}>
        <View style={[styles.monthNav, { backgroundColor: colors.surface }, cardShadow(isDark)]}>
          <IconButton icon={Icons.chevL} label="Previous month" size={38} iconSize={18} onPress={() => go(-1)} />
          <Text weight={800} size={15} numberOfLines={1} style={{ paddingHorizontal: 2 }}>
            {monthName(month, today)}
          </Text>
          <IconButton
            icon={Icons.chevR}
            label="Next month"
            size={38}
            iconSize={18}
            onPress={() => go(1)}
            disabled={month >= thisMonth}
          />
        </View>
        <Segmented
          style={styles.grow}
          value={source}
          onChange={(v) => {
            setSource(v)
            setLimit(PAGE)
          }}
          options={[
            { value: 'all', label: 'Everything' },
            { value: 'personal', label: 'Personal' },
          ]}
          label="What to show"
        />
      </Rise>

      {currencies.length > 1 ? (
        <ChipRow style={{ marginTop: 12 }}>
          {currencies.map((c) => (
            <Chip key={c} tone={c === currency ? 'on' : 'neutral'} selected={c === currency} onPress={() => setPicked(c)}>
              {c}
            </Chip>
          ))}
        </ChipRow>
      ) : null}

      <Rise index={2}>
        <Card onPress={() => router.push({ pathname: '/budget', params: { currency } })} accessibilityLabel="Budget" style={styles.budget}>
          {budget ? (
            <Ring
              value={(row?.total ?? 0) / budget.amountCents}
              color={left < 0 ? colors.owe : colors.accent}
              label={`${Math.round(((row?.total ?? 0) / budget.amountCents) * 100)}% of budget used`}
            >
              <Text display weight={800} size={24} lineHeight={28} tabular>
                {Math.round(((row?.total ?? 0) / budget.amountCents) * 100)}%
              </Text>
              <Label style={{ fontSize: 11 }}>of budget</Label>
            </Ring>
          ) : (
            <Ring value={0}>
              <Icons.piggy color={colors.muted} size={30} />
            </Ring>
          )}
          <View style={styles.grow}>
            <Label>{source === 'personal' ? 'Personal this month' : 'Your share this month'}</Label>
            <Text display weight={800} size={32} lineHeight={38} tracking={-0.035} tabular adjustsFontSizeToFit numberOfLines={1}>
              {money(total, currency)}
            </Text>
            {budget ? (
              <>
                <Sub style={{ marginTop: 4 }}>
                  <Text weight={800} size={13} tabular color={left < 0 ? colors.owe : colors.owed}>
                    {left < 0 ? `${money(-left, currency)} over` : `${money(left, currency)} left`}
                  </Text>{' '}
                  of {money(budget.amountCents, currency)}
                </Sub>
                {daysLeft > 0 && left > 0 ? (
                  <Sub>
                    {money(Math.floor(left / daysLeft), currency)} a day for {daysLeft} {daysLeft === 1 ? 'day' : 'days'}
                  </Sub>
                ) : null}
              </>
            ) : (
              <Text weight={700} size={13.5} color="accentInk" style={{ marginTop: 4 }}>
                Set a monthly budget
              </Text>
            )}
          </View>
        </Card>
      </Rise>

      {source === 'all' && row && row.total > 0 ? (
        <Rise index={3}>
          <Card style={styles.where}>
            <Text weight={800} size={15}>
              Where it went
            </Text>
            <View style={styles.stacked}>
              {[
                [row.groups, colors.accent],
                [row.friends, colors.hues.blue.fg],
                [row.personal, colors.hues.amber.fg],
              ]
                .filter(([v]) => (v as number) > 0)
                .map(([v, c], i) => (
                  <View key={i} style={{ flex: v as number, height: 12, borderRadius: 6, backgroundColor: c as string }} />
                ))}
            </View>
            <View style={styles.legend}>
              {(
                [
                  ['Groups', row.groups, colors.accent],
                  ['Friends', row.friends, colors.hues.blue.fg],
                  ['Personal', row.personal, colors.hues.amber.fg],
                ] as const
              ).map(([label, v, c]) => (
                <View key={label} style={styles.grow}>
                  <View style={styles.legendHead}>
                    <View style={[styles.swatch, { backgroundColor: c }]} />
                    <Label>{label}</Label>
                  </View>
                  <Text weight={800} size={15} tabular>
                    {money(v, currency)}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        </Rise>
      ) : null}

      {categories.length > 0 ? (
        <>
          <Section title="By category" right={<Label>{source === 'personal' ? 'personal' : 'your share'}</Label>} />
          <Rise index={4}>
            <Card style={[styles.gutter, { paddingVertical: 6 }]}>
              {categories.map(([category, cents]) => (
                <Row
                  key={category}
                  minHeight={58}
                  style={{ paddingVertical: 8 }}
                  leading={<CategoryTile category={category} size={38} />}
                  title={
                    <View>
                      <View style={styles.catHead}>
                        <Text weight={700} size={14.5}>
                          {categoryLabel(category)}
                        </Text>
                        <Text weight={700} size={14.5} tabular>
                          {money(cents, currency)}
                        </Text>
                      </View>
                      <View style={{ marginTop: 6 }}>
                        <Bar value={cents / biggest} color={colors.hues[CATEGORY_HUE[category]].fg} height={6} />
                      </View>
                    </View>
                  }
                />
              ))}
            </Card>
          </Rise>
        </>
      ) : null}

      <Section
        title={month === thisMonth ? 'This month' : monthName(month, today)}
        right={list ? <Label>{list.matchCount === 1 ? '1 expense' : `${list.matchCount} expenses`}</Label> : undefined}
      />
      {list && list.tags.length > 0 ? (
        <ChipRow style={{ marginBottom: 10 }}>
          <Chip tone={tag === null ? 'on' : 'neutral'} selected={tag === null} onPress={() => setTag(null)}>
            Any tag
          </Chip>
          {list.tags.map((t) => (
            <Chip key={t} icon={Icons.hash} tone={tag === t ? 'on' : 'neutral'} selected={tag === t} onPress={() => setTag(tag === t ? null : t)}>
              {t}
            </Chip>
          ))}
        </ChipRow>
      ) : null}
      <Rise index={5} style={styles.gutter}>
        {list === undefined ? (
          <SkeletonRows count={4} />
        ) : list.items.length === 0 ? (
          <Card>
            <Empty
              title={source === 'personal' ? 'No personal spending' : 'Nothing spent'}
              hint={month === thisMonth ? 'Add what you spend and it shows up here.' : 'Nothing was added in this month.'}
              action={month === thisMonth ? 'Add expense' : undefined}
              onAction={() => router.push({ pathname: '/add', params: source === 'personal' ? { kind: 'personal' } : {} })}
            />
          </Card>
        ) : (
          <>
            <Card>
              <Rows>
                {list.items.map((item) => (
                  <MonthItemRow key={item.key} item={item} today={today} mode="share" />
                ))}
              </Rows>
            </Card>
            {list.hasMore ? (
              <Button variant="neutral" size="md" style={{ marginTop: 12 }} onPress={() => setLimit((l) => l + PAGE)}>
                Show more
              </Button>
            ) : null}
          </>
        )}
      </Rise>
    </Screen>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  gutter: { marginHorizontal: 16 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 4 },
  monthNav: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 46, paddingHorizontal: 4, borderRadius: 999 },
  budget: { marginTop: 14, marginHorizontal: 16, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 18 },
  where: { marginTop: 12, marginHorizontal: 16, paddingVertical: 16, paddingHorizontal: 18 },
  stacked: { flexDirection: 'row', gap: 3, marginTop: 12 },
  legend: { flexDirection: 'row', gap: 8, marginTop: 12 },
  legendHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  catHead: { flexDirection: 'row', justifyContent: 'space-between' },
})
