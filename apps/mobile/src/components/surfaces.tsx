import { Children, isValidElement, useEffect, useRef, type ReactNode } from 'react'
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'

import { Button } from '@/components/button'
import { Icons, type IconComponent } from '@/components/icons'
import { pressedStyle, useRipple } from '@/components/ripple'
import { Headline, Label, Sub, Text } from '@/components/text'
import { Tile } from '@/components/tiles'
import { tick } from '@/lib/haptics'
import { cardShadow, useColors, useIsDark, useReduceMotion } from '@/theme'

/** A white (or raised dark) card: 24px corners, the soft shadow in light. */
export function Card({
  children,
  style,
  onPress,
  accessibilityLabel,
  padded = false,
}: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  onPress?: () => void
  accessibilityLabel?: string
  padded?: boolean
}) {
  const colors = useColors()
  const isDark = useIsDark()
  const ripple = useRipple(undefined, { strength: 0.08 })
  const base = [
    styles.card,
    { backgroundColor: colors.surface },
    cardShadow(isDark),
    padded && styles.padded,
    style,
  ]
  if (!onPress) return <View style={base}>{children}</View>
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      android_ripple={ripple}
      onPress={() => {
        tick()
        onPress()
      }}
      style={({ pressed }) => [base, pressedStyle(pressed, 0.85)]}
    >
      {children}
    </Pressable>
  )
}

/**
 * Rows separated by hairlines that start after the leading tile (74px in),
 * like the mocks' `.row + .row::before`.
 */
export function Rows({ children, inset = 74 }: { children: ReactNode; inset?: number }) {
  const colors = useColors()
  const items = Children.toArray(children).filter(isValidElement)
  return (
    <>
      {items.map((child, i) => (
        <View key={child.key ?? i}>
          {i > 0 ? <View style={[styles.divider, { left: inset, backgroundColor: colors.divider }]} /> : null}
          {child}
        </View>
      ))}
    </>
  )
}

/** A list row: leading tile or avatar, title and subtitle, and an end slot. */
export function Row({
  leading,
  title,
  subtitle,
  end,
  onPress,
  onLongPress,
  minHeight = 68,
  style,
  accessibilityLabel,
  titleColor,
  titleSize = 15.5,
  wrap = false,
}: {
  leading?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  end?: ReactNode
  onPress?: () => void
  onLongPress?: () => void
  minHeight?: number
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
  titleColor?: string
  titleSize?: number
  /** Let the subtitle wrap instead of cutting it short. */
  wrap?: boolean
}) {
  const body = (
    <>
      {leading}
      <View style={styles.grow}>
        {typeof title === 'string' ? (
          <Text weight={700} size={titleSize} lineHeight={21} tracking={-0.005} numberOfLines={1} color={titleColor}>
            {title}
          </Text>
        ) : (
          title
        )}
        {subtitle === undefined ? null : typeof subtitle === 'string' ? (
          <Sub numberOfLines={wrap ? undefined : 1}>{subtitle}</Sub>
        ) : (
          subtitle
        )}
      </View>
      {end}
    </>
  )
  const rowStyle = [styles.row, { minHeight }, style]
  const ripple = useRipple(undefined, { strength: 0.1 })
  if (!onPress) return <View style={rowStyle}>{body}</View>
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onLongPress={onLongPress}
      android_ripple={ripple}
      style={({ pressed }) => [rowStyle, pressedStyle(pressed)]}
    >
      {body}
    </Pressable>
  )
}

/** The right-hand side of a row: a faint label over an amount. */
export function RowEnd({ label, amount, color, sub }: { label?: string; amount: string; color?: string; sub?: string }) {
  return (
    <View style={styles.end}>
      {label ? <Label>{label}</Label> : null}
      <Text weight={800} size={15.5} lineHeight={21} tabular tracking={-0.01} color={color}>
        {amount}
      </Text>
      {sub ? <Label>{sub}</Label> : null}
    </View>
  )
}

/** A section heading with an optional link on the right. */
export function Section({
  title,
  action,
  onAction,
  right,
  style,
}: {
  title: string
  action?: string
  onAction?: () => void
  right?: ReactNode
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View style={[styles.section, style]}>
      <Headline>{title}</Headline>
      {action && onAction ? (
        <Pressable accessibilityRole="link" onPress={onAction} hitSlop={10}>
          <Text weight={700} size={14} color="accentInk">
            {action}
          </Text>
        </Pressable>
      ) : (
        right
      )}
    </View>
  )
}

/** A sticky-looking day heading in a list: "Today", "Wednesday, 25 Nov". */
export function DayHeading({ children }: { children: string }) {
  return (
    <Text weight={700} size={13} lineHeight={18} color="faint" style={styles.dayHeading}>
      {children}
    </Text>
  )
}

/**
 * Rises 16px into place on first render, `index` × 45ms after the screen
 * opens. Nothing moves with reduced motion.
 */
export function Rise({ index = 0, children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduce = useReduceMotion()
  const progress = useRef(new Animated.Value(reduce ? 1 : 0)).current
  useEffect(() => {
    if (reduce) return
    Animated.timing(progress, {
      toValue: 1,
      duration: 550,
      delay: index * 45,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    }).start()
  }, [index, progress, reduce])
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  )
}

/** A loading placeholder with a slow shimmer. */
export function Skeleton({ width, height = 12, radius = 8, style }: { width?: number | `${number}%`; height?: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const colors = useColors()
  const reduce = useReduceMotion()
  const pulse = useRef(new Animated.Value(0.55)).current
  useEffect(() => {
    if (reduce) return
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.55, duration: 700, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [pulse, reduce])
  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: colors.surface2, opacity: pulse }, style]}
    />
  )
}

/** Rows of skeletons inside a card, while a list loads. */
export function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <Card>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.row, { minHeight: 68 }]}>
          <Skeleton width={44} height={44} radius={15} />
          <View style={[styles.grow, { gap: 8 }]}>
            <Skeleton width="70%" />
            <Skeleton width="45%" height={10} />
          </View>
          <Skeleton width={56} height={14} />
        </View>
      ))}
    </Card>
  )
}

/** An empty state: a tile, a line, a hint and an optional action. */
export function Empty({
  icon = Icons.receipt,
  title,
  hint,
  action,
  onAction,
}: {
  icon?: IconComponent
  title: string
  hint?: string
  action?: string
  onAction?: () => void
}) {
  return (
    <View style={styles.empty}>
      <Tile size={52} radius={18} icon={icon} iconSize={24} />
      <Text weight={800} size={15.5} align="center" style={{ marginTop: 4 }}>
        {title}
      </Text>
      {hint ? <Sub align="center">{hint}</Sub> : null}
      {action && onAction ? (
        <Button variant="tonal" size="sm" icon={Icons.plus} onPress={onAction} style={{ marginTop: 6 }}>
          {action}
        </Button>
      ) : null}
    </View>
  )
}

/** A thin progress bar. `value` is 0–1. */
export function Bar({ value, color, height = 8, track }: { value: number; color: string; height?: number; track?: string }) {
  const colors = useColors()
  const reduce = useReduceMotion()
  const width = useRef(new Animated.Value(reduce ? value : 0)).current
  useEffect(() => {
    Animated.timing(width, {
      toValue: Math.max(0, Math.min(1, value)),
      duration: reduce ? 0 : 800,
      delay: reduce ? 0 : 150,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: false,
    }).start()
  }, [reduce, value, width])
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: track ?? colors.surface2, overflow: 'hidden' }}>
      <Animated.View
        style={{
          height,
          borderRadius: height / 2,
          backgroundColor: color,
          width: width.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, overflow: 'hidden' },
  padded: { padding: 18 },
  divider: { position: 'absolute', right: 16, top: 0, height: StyleSheet.hairlineWidth * 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  grow: { flex: 1, minWidth: 0 },
  end: { alignItems: 'flex-end', gap: 1, flexShrink: 0 },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 26,
    marginBottom: 10,
  },
  dayHeading: { paddingTop: 14, paddingBottom: 6, paddingHorizontal: 20 },
  empty: { alignItems: 'center', gap: 6, paddingTop: 22, paddingBottom: 18, paddingHorizontal: 16 },
})
