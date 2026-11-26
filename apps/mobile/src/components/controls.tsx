import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native'

import { usePressScale } from '@/components/button'
import { Icons, type IconComponent } from '@/components/icons'
import { Text } from '@/components/text'
import { tick } from '@/lib/haptics'
import { fonts, useColors, useIsDark, useReduceMotion } from '@/theme'

export type ChipTone = 'neutral' | 'on' | 'accent' | 'line'

/** A 36px pill: neutral, selected (`on`, ink), accent (tonal) or outlined. */
export function Chip({
  children,
  tone = 'neutral',
  icon: Icon,
  iconRight: IconRight,
  leading,
  onPress,
  height = 36,
  accessibilityLabel,
  selected,
  style,
}: {
  children: ReactNode
  tone?: ChipTone
  icon?: IconComponent
  iconRight?: IconComponent
  leading?: ReactNode
  onPress?: () => void
  height?: number
  accessibilityLabel?: string
  selected?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const colors = useColors()
  const press = usePressScale(0.95)
  const fill = {
    neutral: [colors.surface2, colors.text],
    on: [colors.ink, colors.onInk],
    accent: [colors.accentSoft, colors.accentInk],
    line: ['transparent', colors.text],
  }[tone] as [string, string]
  return (
    <Animated.View style={[press.style, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={selected === undefined ? undefined : { selected }}
        aria-selected={selected}
        disabled={!onPress}
        onPress={() => {
          tick()
          onPress?.()
        }}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={[
          styles.chip,
          {
            height,
            backgroundColor: fill[0],
            paddingLeft: leading ? 6 : 14,
            borderWidth: tone === 'line' ? 1.5 : 0,
            borderColor: colors.surface3,
          },
        ]}
      >
        {leading}
        {Icon ? <Icon color={fill[1]} size={16} /> : null}
        <Text weight={600} size={14} lineHeight={18} color={fill[1]} numberOfLines={1}>
          {children}
        </Text>
        {IconRight ? <IconRight color={fill[1]} size={16} /> : null}
      </Pressable>
    </Animated.View>
  )
}

/** A row of chips that scrolls sideways past the screen edge. */
export function ChipRow({ children, style, gap = 8 }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={[{ flexGrow: 0 }, style]}
      contentContainerStyle={{ gap, paddingHorizontal: 20 }}
    >
      {children}
    </ScrollView>
  )
}

/** The segmented control: a pill track with the chosen segment raised. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  height = 46,
  style,
  label,
}: {
  value: T
  options: Array<{ value: T; label: string; icon?: IconComponent }>
  onChange: (value: T) => void
  height?: number
  style?: StyleProp<ViewStyle>
  label?: string
}) {
  const colors = useColors()
  const isDark = useIsDark()
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={[styles.seg, { height, backgroundColor: colors.surface2 }, style]}
    >
      {options.map((option) => {
        const on = option.value === value
        const Icon = option.icon
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            aria-selected={on}
            onPress={() => {
              if (!on) tick()
              onChange(option.value)
            }}
            style={[
              styles.segItem,
              on && {
                backgroundColor: isDark ? colors.surface3 : colors.surface,
                shadowColor: '#141228',
                shadowOpacity: isDark ? 0 : 0.1,
                shadowRadius: 3,
                shadowOffset: { width: 0, height: 1 },
                elevation: isDark ? 0 : 1,
              },
            ]}
          >
            {Icon ? <Icon color={on ? colors.text : colors.muted} size={15} /> : null}
            <Text weight={700} size={14} color={on ? 'text' : 'muted'} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

/** A 52×32 switch whose thumb springs across. */
export function Switch({ value, onChange, label }: { value: boolean; onChange: (value: boolean) => void; label: string }) {
  const colors = useColors()
  const reduce = useReduceMotion()
  const x = useRef(new Animated.Value(value ? 1 : 0)).current
  useEffect(() => {
    if (reduce) x.setValue(value ? 1 : 0)
    else Animated.spring(x, { toValue: value ? 1 : 0, useNativeDriver: true, bounciness: 8, speed: 18 }).start()
  }, [reduce, value, x])
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => {
        tick()
        onChange(!value)
      }}
      hitSlop={8}
      style={[styles.switch, { backgroundColor: value ? colors.accent : colors.surface3 }]}
    >
      <Animated.View
        style={[
          styles.thumb,
          {
            backgroundColor: value ? colors.onAccent : colors.surface,
            transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }) }],
          },
        ]}
      />
    </Pressable>
  )
}

/** A 26px rounded checkbox. */
export function Checkbox({ checked }: { checked: boolean }) {
  const colors = useColors()
  return (
    <View
      style={[
        styles.cb,
        checked
          ? { backgroundColor: colors.accent }
          : { borderWidth: 2, borderColor: colors.surface3 },
      ]}
    >
      {checked ? <Icons.check color={colors.onAccent} size={17} /> : null}
    </View>
  )
}

/** A labelled 56px field with a focus ring, and an error line under it. */
export function Field({
  label,
  hint,
  error,
  icon: Icon,
  right,
  style,
  inputStyle,
  ...input
}: TextInputProps & {
  label?: string
  hint?: string
  error?: string | null
  icon?: IconComponent
  right?: ReactNode
  style?: StyleProp<ViewStyle>
  inputStyle?: TextInputProps['style']
}) {
  const colors = useColors()
  const [focused, setFocused] = useState(false)
  return (
    <View style={[styles.field, style]}>
      {label ? (
        <Text weight={700} size={13} lineHeight={16} color={error ? 'owe' : 'muted'}>
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.input,
          {
            backgroundColor: focused || error ? colors.surface : colors.surface2,
            borderColor: error ? colors.owe : focused ? colors.accent : 'transparent',
          },
        ]}
      >
        {Icon ? <Icon color={colors.faint} size={18} /> : null}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.faint}
          selectionColor={colors.accent}
          cursorColor={colors.accent}
          {...input}
          onFocus={(e) => {
            setFocused(true)
            input.onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            input.onBlur?.(e)
          }}
          style={[styles.textInput, { color: colors.text }, inputStyle]}
        />
        {right}
      </View>
      {error ? (
        <Text weight={600} size={13} color="owe" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text weight={500} size={12.5} color="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  )
}

/** A round − or + button for steppers. */
export function StepButton({ icon: Icon, onPress, label }: { icon: IconComponent; onPress: () => void; label: string }) {
  const colors = useColors()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        tick()
        onPress()
      }}
      hitSlop={6}
      style={({ pressed }) => [styles.step, { backgroundColor: pressed ? colors.surface3 : colors.surface2 }]}
    >
      <Icon color={colors.text} size={18} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 14,
    borderRadius: 999,
  },
  seg: { flexDirection: 'row', padding: 4, borderRadius: 999, gap: 2 },
  segItem: {
    flex: 1,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  switch: { width: 52, height: 32, borderRadius: 16, padding: 4 },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  cb: { width: 26, height: 26, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  field: { gap: 8 },
  input: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 2,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  textInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.sans[600],
    fontSize: 16,
    paddingVertical: 12,
  },
  step: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
})
