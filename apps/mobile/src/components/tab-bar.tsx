import type { Tabs } from 'expo-router'
import type { ComponentProps, ComponentType } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

import { AssistantIcon, FriendsIcon, GroupsIcon, HomeIcon, PersonalIcon } from '@/components/icons'
import { Text } from '@/components/text'
import { useColors } from '@/theme'

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0]
type IconComponent = ComponentType<{ color: string; strokeWidth?: number }>

// Keyed by route name in src/app/(tabs).
const TABS: Record<string, { label: string; Icon: IconComponent }> = {
  index: { label: 'Home', Icon: HomeIcon },
  groups: { label: 'Groups', Icon: GroupsIcon },
  friends: { label: 'Friends', Icon: FriendsIcon },
  personal: { label: 'Personal', Icon: PersonalIcon },
  assistant: { label: 'Assistant', Icon: AssistantIcon },
}

/** The flat bottom bar from the Android mocks: a 3px accent bar over the active tab. */
export function TabBar({ state, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const colors = useColors()

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.bar,
        {
          backgroundColor: colors.bgSidebar,
          borderTopColor: colors.surface2,
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const tab = TABS[route.name]
        if (!tab) return null
        const active = state.index === index
        const color = active ? colors.accent : colors.muted
        const onPress = () => {
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
          if (!active && !event.defaultPrevented) navigateToTab(route.key)
        }
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
            onPress={onPress}
            style={styles.tab}
          >
            {active && <View style={[styles.indicator, { backgroundColor: colors.accent }]} />}
            <tab.Icon color={color} strokeWidth={active ? 2 : 1.8} />
            <Text size={12} weight={active ? 600 : 500} style={{ color }}>
              {tab.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    minHeight: 72,
  },
  tab: {
    flex: 1,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  indicator: {
    position: 'absolute',
    top: -1,
    width: 32,
    height: 3,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
})
