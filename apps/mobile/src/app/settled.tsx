import type { Currency } from '@settlr/shared/schemas'
import { useLocalSearchParams, useRouter, type Href } from 'expo-router'
import { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Button } from '@/components/button'
import { Icons } from '@/components/icons'
import { TopBar } from '@/components/screen'
import { Card } from '@/components/surfaces'
import { Label, Sub, Text } from '@/components/text'
import { Avatar, Badge } from '@/components/tiles'
import { firstName, money } from '@/lib/format'
import { useColors, useReduceMotion } from '@/theme'

type Params = {
  name: string
  amount: string
  currency: string
  before: string
  after: string
  youPaid?: string
  href: string
  note?: string
  group?: string
  mine?: string
  linked?: string
}

/** After Slide to record: the check pops, rings ripple, the old balance is struck through. */
export default function SettledScreen() {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const reduce = useReduceMotion()
  const p = useLocalSearchParams<Params>()
  const currency = (p.currency || 'INR') as Currency
  const amount = Number(p.amount || 0)
  const before = Number(p.before || 0)
  const after = Number(p.after || 0)
  const first = firstName(p.name ?? '')
  const inGroup = Boolean(p.group)
  const mine = !inGroup || p.mine === '1'

  const pop = useRef(new Animated.Value(reduce ? 1 : 0)).current
  const strike = useRef(new Animated.Value(reduce ? 1 : 0)).current
  const rings = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current]

  useEffect(() => {
    if (reduce) return
    Animated.spring(pop, { toValue: 1, delay: 150, useNativeDriver: true, bounciness: 14, speed: 10 }).start()
    Animated.timing(strike, { toValue: 1, delay: 700, duration: 500, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: false }).start()
    const loops = rings.map((ring, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(300 + i * 800),
          Animated.timing(ring, { toValue: 1, duration: 2400, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: true }),
          Animated.timing(ring, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ),
    )
    loops.forEach((l) => l.start())
    return () => loops.forEach((l) => l.stop())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce])

  const title = !mine ? 'Payment recorded' : after === 0 ? `All square with ${first}` : 'Payment recorded'
  const who = p.youPaid ? `You paid ${money(amount, currency)}` : `${first} paid you ${money(amount, currency)}`
  const line = [mine ? who : `${p.name}: ${money(amount, currency)}`, 'today', p.note].filter(Boolean).join(' · ')

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top + 4, paddingBottom: insets.bottom + 16 }]}>
      <TopBar close />
      <View style={styles.body}>
        <View style={styles.burst}>
          {rings.map((ring, i) => (
            <Animated.View
              key={i}
              style={[
                styles.ring,
                {
                  borderColor: colors.owed,
                  opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
                  transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.1] }) }],
                },
              ]}
            />
          ))}
          <Animated.View style={[styles.check, { backgroundColor: colors.owed, transform: [{ scale: pop }] }]}>
            <Icons.check color={colors.bg} size={56} strokeWidth={2.8} />
          </Animated.View>
        </View>
        <Text accessibilityRole="header" display weight={800} size={34} lineHeight={40} tracking={-0.03} align="center" style={{ marginTop: 36 }}>
          {title}
        </Text>
        <Sub size={15} lineHeight={22} align="center" style={{ marginTop: 10 }}>
          {line}.{'\n'}
          {p.linked ? 'They get a notification, and both ledgers update.' : 'Your ledger is up to date.'}
        </Sub>

        {mine ? (
          <Card style={styles.card}>
            {inGroup ? null : <Avatar name={p.name ?? ''} />}
            <View style={styles.flex}>
              <Label>{inGroup ? `Your balance in ${p.group}` : `Your balance with ${first}`}</Label>
              <View style={styles.line}>
                <View>
                  <Text weight={800} size={15.5} tabular color={before > 0 ? colors.owed : before < 0 ? colors.owe : colors.text}>
                    {money(before, currency)}
                  </Text>
                  <Animated.View
                    style={[
                      styles.strike,
                      { backgroundColor: before > 0 ? colors.owed : colors.owe, width: strike.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
                    ]}
                  />
                </View>
                <Icons.arrowR color={colors.faint} size={15} />
                {after === 0 ? (
                  <Badge tone="owed" size="md" icon={Icons.check}>
                    settled up
                  </Badge>
                ) : (
                  <Text weight={800} size={15.5} tabular color={after > 0 ? colors.owed : colors.owe}>
                    {after > 0 ? `you’re owed ${money(after, currency)}` : `you owe ${money(after, currency)}`}
                  </Text>
                )}
              </View>
            </View>
          </Card>
        ) : null}
      </View>
      <View style={styles.actions}>
        <Button wide onPress={() => router.back()} style={{ height: 56 }}>
          Done
        </Button>
        <Button
          wide
          variant="neutral"
          onPress={() => {
            router.back()
            router.push(p.href as Href)
          }}
        >
          {inGroup ? 'See the group' : 'See the ledger'}
        </Button>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  burst: { width: 120, height: 120 },
  ring: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 60, borderWidth: 2 },
  check: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 60, alignItems: 'center', justifyContent: 'center' },
  card: { marginTop: 28, alignSelf: 'stretch', paddingVertical: 16, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  strike: { position: 'absolute', left: 0, top: '50%', height: 2 },
  actions: { paddingHorizontal: 16, gap: 10 },
})
