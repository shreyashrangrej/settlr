import type { ReactNode } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Text } from '@/components/text'
import { radius, space, useColors } from '@/theme'

/** A tab's page: the 22px title row from the mocks, then scrolling content. */
export function Screen({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  children?: ReactNode
}) {
  const colors = useColors()
  const insets = useSafeAreaInsets()
  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
    >
      <View style={styles.header}>
        <View style={styles.titles}>
          {subtitle ? (
            <Text size={13} color="muted">
              {subtitle}
            </Text>
          ) : null}
          <Text size={21} weight={600} style={styles.title}>
            {title}
          </Text>
        </View>
        {actions}
      </View>
      {children}
    </ScrollView>
  )
}

/** Stand-in body for tabs whose real content comes in a later phase. */
export function Placeholder({ children }: { children: ReactNode }) {
  const colors = useColors()
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.gutter,
    paddingBottom: 32,
    gap: space.gap,
  },
  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  titles: { flex: 1, gap: 2 },
  title: {},
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
})
