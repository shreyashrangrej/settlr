import type { Tabs } from 'expo-router'
import { useRouter } from 'expo-router'
import { useEffect, useRef, type ComponentProps } from 'react'
import { Animated, Pressable, StyleSheet, View } from 'react-native'

import { usePressScale } from '@/components/button'
import { Icons, type IconComponent } from '@/components/icons'
import { useRipple } from '@/components/ripple'
import { Text } from '@/components/text'
import { tick } from '@/lib/haptics'
import { useColors, useIsDark, useReduceMotion } from '@/theme'

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0]

// Keyed by route name in src/app/(tabs). Add sits in the middle.
const TABS: Record<string, { label: string; icon: IconComponent }> = {
  index: { label: 'Home', icon: Icons.home },
  groups: { label: 'Groups', icon: Icons.users },
  friends: { label: 'Friends', icon: Icons.user },
  spending: { label: 'Spending', icon: Icons.pie },
}

/**
 * The floating bar from the mocks: 60px tall, 12px off the edges, the
 * active tab in a violet pill, and the violet + in the middle that opens
 * Add expense.
 */
export function TabBar({ state, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const colors = useColors()
  const isDark = useIsDark()
  const router = useRouter()
  const add = usePressScale(0.92)
  const addRipple = useRipple(colors.onAccent, { strength: 0.24 })

  const items = state.routes.filter((route) => TABS[route.name])
  const half = Math.ceil(items.length / 2)

  const tab = (route: (typeof state.routes)[number]) => {
    const meta = TABS[route.name]!
    const index = state.routes.indexOf(route)
    const active = state.index === index
    const onPress = () => {
      const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
      if (!active && !event.defaultPrevented) {
        tick()
        navigateToTab(route.key)
      }
    }
    return <TabItem key={route.key} label={meta.label} icon={meta.icon} active={active} onPress={onPress} />
  }

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.bar,
        {
          bottom: insets.bottom + 14,
          backgroundColor: colors.nav,
          borderColor: colors.navLine,
          shadowOpacity: isDark ? 0.5 : 0.12,
        },
      ]}
    >
      {items.slice(0, half).map(tab)}
      <Animated.View style={[styles.addCell, add.style]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add expense"
          onPress={() => {
            tick()
            router.push('/add')
          }}
          onPressIn={add.onPressIn}
          onPressOut={add.onPressOut}
          android_ripple={addRipple}
          style={[
            styles.add,
            { backgroundColor: colors.accent, shadowOpacity: isDark ? 0 : 0.28, elevation: isDark ? 0 : 6 },
          ]}
        >
          <Icons.plus color={colors.onAccent} size={22} />
        </Pressable>
      </Animated.View>
      {items.slice(half).map(tab)}
    </View>
  )
}

function TabItem({
  label,
  icon: Icon,
  active,
  onPress,
}: {
  label: string
  icon: IconComponent
  active: boolean
  onPress: () => void
}) {
  const colors = useColors()
  const reduce = useReduceMotion()
  const width = useRef(new Animated.Value(active ? 1 : 0)).current
  useEffect(() => {
    Animated.timing(width, { toValue: active ? 1 : 0, duration: reduce ? 0 : 250, useNativeDriver: false }).start()
  }, [active, reduce, width])
  const color = active ? colors.accentInk : colors.faint
  // Spreads as a circle around the icon, like Android's own nav bar.
  const ripple = useRipple(colors.accentInk, { borderless: true, radius: 30, strength: 0.16 })
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      android_ripple={ripple}
      style={styles.item}
    >
      <Animated.View
        style={[
          styles.pill,
          {
            width: width.interpolate({ inputRange: [0, 1], outputRange: [40, 48] }),
            backgroundColor: width.interpolate({
              inputRange: [0, 1],
              outputRange: ['transparent', colors.accentSoft],
            }),
          },
        ]}
      >
        <Icon color={color} size={20} />
      </Animated.View>
      <Text weight={active ? 800 : 600} size={11} lineHeight={14} color={color}>
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 12,
    right: 12,
    height: 60,
    paddingHorizontal: 4,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#141228',
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, height: 56 },
  pill: { height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  addCell: { flex: 1, alignItems: 'center' },
  add: {
    width: 44,
    height: 44,
    borderRadius: 15,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4A2BE0',
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
})
