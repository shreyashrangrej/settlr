import { useRef, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'

import type { IconComponent } from '@/components/icons'
import { useRipple } from '@/components/ripple'
import { Text } from '@/components/text'
import { tick } from '@/lib/haptics'
import { useColors, useReduceMotion } from '@/theme'

export type Variant = 'primary' | 'tonal' | 'neutral' | 'outline' | 'contrast' | 'danger' | 'dangerTonal' | 'green'

const HEIGHT = { xl: 58, lg: 52, md: 40, sm: 34 } as const
const FONT = { xl: 17, lg: 16, md: 14, sm: 13.5 } as const
const PAD = { xl: 22, lg: 22, md: 16, sm: 14 } as const

/** Pressing scales to `to` on a quick spring, unless motion is reduced. */
export function usePressScale(to = 0.96) {
  const scale = useRef(new Animated.Value(1)).current
  const reduce = useReduceMotion()
  const animate = (value: number) => {
    if (reduce) return
    Animated.spring(scale, { toValue: value, useNativeDriver: true, speed: 50, bounciness: 6 }).start()
  }
  return {
    style: { transform: [{ scale }] },
    onPressIn: () => animate(to),
    onPressOut: () => animate(1),
  }
}

/**
 * Tally's pill buttons: 58px for the one primary action, 52 at the bottom
 * of a screen, 40 in cards and 34 inside rows.
 */
export function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  disabled = false,
  wide = false,
  style,
  colors: custom,
  accessibilityLabel,
  haptic = true,
}: {
  children: ReactNode
  onPress?: () => void
  variant?: Variant
  size?: keyof typeof HEIGHT
  icon?: IconComponent
  iconRight?: IconComponent
  loading?: boolean
  disabled?: boolean
  wide?: boolean
  style?: StyleProp<ViewStyle>
  /** Overrides the variant's fill and text colour. */
  colors?: { bg: string; fg: string; border?: string }
  accessibilityLabel?: string
  haptic?: boolean
}) {
  const colors = useColors()
  const press = usePressScale()
  const fills: Record<Variant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.accent, fg: colors.onAccent },
    tonal: { bg: colors.accentSoft, fg: colors.accentInk },
    neutral: { bg: colors.surface2, fg: colors.text },
    outline: { bg: 'transparent', fg: colors.text, border: colors.surface3 },
    contrast: { bg: colors.ink, fg: colors.onInk },
    danger: { bg: colors.owe, fg: colors.onOwe },
    dangerTonal: { bg: colors.oweSoft, fg: colors.owe },
    green: { bg: colors.owedSoft, fg: colors.owed },
  }
  const fill = custom ?? fills[variant]
  const inactive = disabled || loading
  const iconSize = size === 'xl' || size === 'lg' ? 20 : 17
  const ripple = useRipple(fill.fg, { strength: 0.2 })

  return (
    <Animated.View style={[press.style, wide && styles.wide, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: inactive, busy: loading }}
        disabled={inactive}
        android_ripple={ripple}
        onPress={() => {
          if (haptic) tick()
          onPress?.()
        }}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={[
          styles.base,
          {
            height: HEIGHT[size],
            paddingHorizontal: PAD[size],
            backgroundColor: fill.bg,
            borderWidth: fill.border ? 1.5 : 0,
            borderColor: fill.border,
            opacity: disabled ? 0.45 : 1,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={fill.fg} />
        ) : (
          <View style={styles.row}>
            {Icon ? <Icon color={fill.fg} size={iconSize} /> : null}
            <Text weight={800} size={FONT[size]} lineHeight={FONT[size] + 4} color={fill.fg} numberOfLines={1}>
              {children}
            </Text>
            {IconRight ? <IconRight color={fill.fg} size={iconSize} /> : null}
          </View>
        )}
      </Pressable>
    </Animated.View>
  )
}

/** A round 44px icon button: bare, filled (`surface`) or neutral (`surface2`). */
export function IconButton({
  icon: Icon,
  onPress,
  label,
  tone = 'bare',
  size = 44,
  iconSize = 22,
  color,
  bg,
  dot = false,
  disabled,
}: {
  icon: IconComponent
  onPress?: () => void
  label: string
  tone?: 'bare' | 'filled' | 'neutral'
  size?: number
  iconSize?: number
  color?: string
  bg?: string
  dot?: boolean
  disabled?: boolean
}) {
  const colors = useColors()
  const press = usePressScale(0.9)
  const background =
    bg ?? (tone === 'filled' ? colors.surface : tone === 'neutral' ? colors.surface2 : 'transparent')
  // A bare icon's ripple spreads as a circle a little past it.
  const bare = background === 'transparent'
  const ripple = useRipple(color ?? colors.text, { borderless: bare, radius: bare ? size / 2 + 2 : undefined })
  return (
    <Animated.View style={press.style}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        android_ripple={ripple}
        onPress={() => {
          tick()
          onPress?.()
        }}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        hitSlop={4}
        style={[
          styles.icon,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: background, opacity: disabled ? 0.4 : 1 },
          !bare && styles.clip,
        ]}
      >
        <Icon color={color ?? colors.text} size={iconSize} />
        {dot ? (
          <View style={[styles.dot, { backgroundColor: colors.owe, borderColor: tone === 'filled' ? colors.surface : colors.bg }]} />
        ) : null}
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  base: { borderRadius: 999, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  wide: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: { alignItems: 'center', justifyContent: 'center' },
  clip: { overflow: 'hidden' },
  dot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2.5,
  },
})
