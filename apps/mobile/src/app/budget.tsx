import { api } from '@settlr/backend/convex/_generated/api'
import { categoryLabel } from '@settlr/shared/format'
import { CATEGORIES, CURRENCIES, type Category, type Currency } from '@settlr/shared/schemas'
import { useMutation, useQuery } from 'convex/react'
import { useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { Button, IconButton } from '@/components/button'
import { Chip, ChipRow, Field } from '@/components/controls'
import { Icons } from '@/components/icons'
import { confirm, Sheet, SheetTitle } from '@/components/overlay'
import { Screen, TopBar } from '@/components/screen'
import { Bar, Card, Rise } from '@/components/surfaces'
import { Label, Sub, Text, Title } from '@/components/text'
import { Badge, CategoryTile } from '@/components/tiles'
import { useRun } from '@/lib/actions'
import { CATEGORY_HUE } from '@/lib/category'
import { currencySymbol, localIsoDate, money, monthName } from '@/lib/format'
import { amountCents, centsToAmount, cleanAmount } from '@/lib/keypad'
import { usePrefs } from '@/lib/prefs'
import { useColors } from '@/theme'

type Editing = { kind: 'budget' } | { kind: 'category'; category: Category } | null

/** The monthly budget for a currency, and optional limits per category. */
export default function BudgetScreen() {
  const colors = useColors()
  const prefs = usePrefs()
  const params = useLocalSearchParams<{ currency?: string }>()
  const today = localIsoDate()
  const month = today.slice(0, 7)
  const budgets = useQuery(api.budgets.list)
  const spending = useQuery(api.budgets.monthSpending, { month })
  const setBudget = useMutation(api.budgets.set)
  const removeBudget = useMutation(api.budgets.remove)
  const setCategory = useMutation(api.budgets.setCategory)
  const { run, pending } = useRun()
  const [currency, setCurrency] = useState<Currency>(
    CURRENCIES.includes(params.currency as Currency) ? (params.currency as Currency) : prefs.currency,
  )
  const [editing, setEditing] = useState<Editing>(null)

  const budget = budgets?.find((b) => b.currency === currency)
  const row = spending?.find((s) => s.currency === currency)
  const spent = row?.total ?? 0
  const daysInMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()
  const day = Number(today.slice(8, 10))
  const pace = day / daysInMonth
  const left = budget ? budget.amountCents - spent : 0
  const underPace = budget ? Math.round(budget.amountCents * pace) - spent : 0
  const daysLeft = daysInMonth - day + 1
  const shown = [...new Set<Currency>([...(budgets ?? []).map((b) => b.currency), currency])]

  return (
    <Screen>
      <TopBar backLabel="Back to spending" />
      <View style={styles.head}>
        <Title>Budget</Title>
      </View>
      <ChipRow style={{ marginTop: 12 }}>
        {shown.map((c) => (
          <Chip key={c} tone={c === currency ? 'on' : 'neutral'} selected={c === currency} onPress={() => setCurrency(c)}>
            {`${currencySymbol(c)} ${c}`}
          </Chip>
        ))}
        {CURRENCIES.filter((c) => !shown.includes(c)).map((c) => (
          <Chip key={c} tone="line" onPress={() => setCurrency(c)}>
            {`${currencySymbol(c)} ${c}`}
          </Chip>
        ))}
      </ChipRow>

      <Rise index={1}>
        <Card style={styles.card}>
          <Label>Every month</Label>
          <View style={styles.amountRow}>
            <Text display weight={800} size={46} lineHeight={54} tracking={-0.045} tabular color={budget ? colors.text : colors.dim}>
              {budget ? money(budget.amountCents, currency) : money(0, currency)}
            </Text>
            <IconButton icon={Icons.pen} tone="neutral" size={36} iconSize={17} label="Change budget" onPress={() => setEditing({ kind: 'budget' })} />
          </View>
          <Sub size={13.5} lineHeight={19} style={{ marginTop: 6 }}>
            Counts your personal spending and your share of every group and friend expense. Settle-up payments don't count.
          </Sub>
          {!budget ? (
            <Button size="md" icon={Icons.plus} style={{ marginTop: 14, alignSelf: 'flex-start' }} onPress={() => setEditing({ kind: 'budget' })}>
              Set a budget
            </Button>
          ) : null}
        </Card>
      </Rise>

      {budget ? (
        <>
          <Rise index={2}>
            <Card style={styles.card}>
              <View style={styles.between}>
                <Text weight={800} size={15}>
                  {monthName(month, today)} so far
                </Text>
                {underPace >= 0 ? (
                  <Badge tone="owed" icon={Icons.check}>{`${money(underPace, currency)} under pace`}</Badge>
                ) : (
                  <Badge tone="owe" icon={Icons.alert}>{`${money(-underPace, currency)} over pace`}</Badge>
                )}
              </View>
              <View style={{ marginTop: 16 }}>
                <Bar value={spent / budget.amountCents} color={left < 0 ? colors.owe : colors.accent} height={14} />
                <View style={[styles.today, { left: `${pace * 100}%`, backgroundColor: colors.text }]} />
                <Label style={[styles.todayLabel, { left: `${pace * 100}%` }]}>today</Label>
              </View>
              <View style={styles.stats}>
                <Stat label="Spent" value={money(spent, currency)} />
                <Stat label={left < 0 ? 'Over' : 'Left'} value={money(left, currency)} color={left < 0 ? colors.owe : colors.owed} />
                <Stat label={`A day, ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`} value={money(Math.max(0, Math.floor(left / daysLeft)), currency)} />
              </View>
            </Card>
          </Rise>

          <Rise index={3}>
            <Card style={styles.card}>
              <View style={styles.between}>
                <Text weight={800} size={15}>
                  Category limits
                </Text>
                <Label>optional, within {money(budget.amountCents, currency)}</Label>
              </View>
              <View style={{ marginTop: 14, gap: 14 }}>
                {CATEGORIES.map((category) => {
                  const limit = budget.byCategory[category]
                  const used = row?.byCategory[category] ?? 0
                  const over = limit !== undefined && used > limit
                  return (
                    <View key={category} style={styles.catRow}>
                      <CategoryTile category={category} size={36} />
                      <View style={styles.grow}>
                        <View style={styles.between}>
                          <Text weight={700} size={14.5}>
                            {categoryLabel(category)}
                          </Text>
                          <Text weight={700} size={14.5} tabular color={over ? colors.owe : colors.muted}>
                            {money(used, currency)}
                            {limit !== undefined ? (
                              <Text weight={600} size={14.5} color={over ? colors.owe : colors.faint}>
                                {' '}
                                of {money(limit, currency)}
                              </Text>
                            ) : null}
                          </Text>
                        </View>
                        {limit !== undefined ? (
                          <View style={{ marginTop: 6 }}>
                            <Bar value={limit ? used / limit : 1} height={6} color={over ? colors.owe : colors.hues[CATEGORY_HUE[category]].fg} />
                            {over ? (
                              <Text weight={700} size={12} color={colors.owe} style={{ marginTop: 4 }}>
                                {money(used - limit, currency)} over
                              </Text>
                            ) : null}
                          </View>
                        ) : (
                          <Sub size={12}>No limit</Sub>
                        )}
                      </View>
                      <IconButton
                        icon={limit !== undefined ? Icons.pen : Icons.plus}
                        size={34}
                        iconSize={16}
                        label={`${limit !== undefined ? 'Change' : 'Set'} ${categoryLabel(category)} limit`}
                        onPress={() => setEditing({ kind: 'category', category })}
                      />
                    </View>
                  )
                })}
              </View>
            </Card>
          </Rise>
          <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
            <Button
              variant="dangerTonal"
              icon={Icons.trash}
              loading={pending}
              onPress={async () => {
                const ok = await confirm({ title: `Remove your ${currency} budget?`, body: 'Its category limits go too.', confirm: 'Remove', destructive: true })
                if (ok) run(() => removeBudget({ currency }), 'Budget removed')
              }}
            >
              {`Remove the ${currency} budget`}
            </Button>
          </View>
        </>
      ) : null}

      <AmountSheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.kind === 'category' ? `${categoryLabel(editing.category)} limit` : `Monthly ${currency} budget`}
        currency={currency}
        initial={editing?.kind === 'category' ? budget?.byCategory[editing.category] : budget?.amountCents}
        canRemove={editing?.kind === 'category' && budget?.byCategory[editing.category] !== undefined}
        onSave={async (cents) => {
          if (!editing) return
          const done =
            editing.kind === 'budget'
              ? await run(() => setBudget({ currency, amountCents: cents }), 'Budget saved')
              : await run(() => setCategory({ currency, category: editing.category, amountCents: cents }), 'Limit saved')
          if (done !== undefined) setEditing(null)
        }}
        onRemove={async () => {
          if (editing?.kind !== 'category') return
          const done = await run(() => setCategory({ currency, category: editing.category, amountCents: null }), 'Limit removed')
          if (done !== undefined) setEditing(null)
        }}
      />
    </Screen>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.grow}>
      <Label>{label}</Label>
      <Text weight={800} size={17} tabular color={color}>
        {value}
      </Text>
    </View>
  )
}

function AmountSheet({
  open,
  onClose,
  title,
  currency,
  initial,
  canRemove,
  onSave,
  onRemove,
}: {
  open: boolean
  onClose: () => void
  title: string
  currency: Currency
  initial: number | undefined
  canRemove: boolean
  onSave: (cents: number) => void
  onRemove: () => void
}) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (open) {
      setText(initial ? centsToAmount(initial) : '')
      setError(null)
    }
  }, [initial, open])
  return (
    <Sheet open={open} onClose={onClose} label={title}>
      <SheetTitle>{title}</SheetTitle>
      <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 14 }}>
        <Field
          label={`Amount in ${currency}`}
          value={text}
          onChangeText={(t) => {
            setText(cleanAmount(t))
            setError(null)
          }}
          keyboardType="decimal-pad"
          autoFocus
          placeholder="0"
          error={error}
          right={<Text weight={700} size={16} color="faint">{currencySymbol(currency)}</Text>}
        />
        <Button
          wide
          onPress={() => {
            const cents = amountCents(text)
            if (cents <= 0) return setError('Enter an amount more than zero.')
            onSave(cents)
          }}
        >
          Save
        </Button>
        {canRemove ? (
          <Button wide variant="neutral" onPress={onRemove}>
            Remove limit
          </Button>
        ) : null}
      </View>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  head: { paddingHorizontal: 20 },
  card: { marginTop: 12, marginHorizontal: 16, padding: 18 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  today: { position: 'absolute', top: -6, bottom: -6, width: 2, borderRadius: 1 },
  todayLabel: { position: 'absolute', top: 22, marginLeft: -14 },
  stats: { flexDirection: 'row', gap: 8, marginTop: 30 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
})
