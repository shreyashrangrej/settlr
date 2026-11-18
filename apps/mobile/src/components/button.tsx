import type { ReactNode } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native'

import { Text } from '@/components/text'
import { radius, useColors } from '@/theme'

type Variant = 'primary' | 'outline' | 'contrast' | 'ghost'

/** T3 Code's mobile buttons: pills, 48px tall (`size="lg"`) or 40px, medium weight. */
export function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  loading = false,
  disabled = false,
  style,
  accessibilityLabel,
}: {
  children: ReactNode
  onPress?: () => void
  variant?: Variant
  size?: 'lg' | 'md'
  icon?: ReactNode
  loading?: boolean
  disabled?: boolean
  style?: ViewStyle
  accessibilityLabel?: string
}) {
  const colors = useColors()
  const fill = {
    primary: { backgroundColor: colors.accent, borderColor: colors.accent, text: colors.onAccent },
    outline: { backgroundColor: 'transparent', borderColor: colors.borderStrong, text: colors.text },
    contrast: { backgroundColor: colors.contrast, borderColor: colors.contrast, text: colors.contrastText },
    ghost: { backgroundColor: 'transparent', borderColor: 'transparent', text: colors.muted },
  }[variant]
  const inactive = disabled || loading

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' ? styles.lg : styles.md,
        { backgroundColor: fill.backgroundColor, borderColor: fill.borderColor },
        (pressed || disabled) && { opacity: disabled ? 0.5 : 0.85 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fill.text} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text size={size === 'lg' ? 16 : 14} weight={500} style={{ color: fill.text }}>
            {children}
          </Text>
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lg: { height: 48, paddingHorizontal: 20 },
  md: { height: 40, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
})
