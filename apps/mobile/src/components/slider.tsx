import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, PanResponder, StyleSheet, View } from 'react-native'

import { Icons } from '@/components/icons'
import { Text } from '@/components/text'
import { tick } from '@/lib/haptics'
import { useColors, useIsDark, useReduceMotion } from '@/theme'

const THUMB = 56
const PAD = 5

/**
 * Slide to record: the thumb follows your finger (rubber-banding past the
 * end) and records when let go past 80%. A screen reader gets a plain
 * button instead.
 */
export function SlideToConfirm({
  label,
  onConfirm,
  disabled = false,
  busy = false,
}: {
  label: string
  onConfirm: () => void
  disabled?: boolean
  busy?: boolean
}) {
  const colors = useColors()
  const isDark = useIsDark()
  const reduce = useReduceMotion()
  const [width, setWidth] = useState(0)
  const x = useRef(new Animated.Value(0)).current
  const nudge = useRef(new Animated.Value(0)).current
  const max = Math.max(0, width - THUMB - PAD * 2)
  const state = useRef({ max, disabled, onConfirm })
  state.current = { max, disabled: disabled || busy, onConfirm }

  // A nudge every few seconds, so it reads as something to slide.
  useEffect(() => {
    if (reduce || disabled) return
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1500),
        Animated.timing(nudge, { toValue: 18, duration: 300, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: true }),
        Animated.timing(nudge, { toValue: 5, duration: 300, useNativeDriver: true }),
        Animated.timing(nudge, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [disabled, nudge, reduce])

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !state.current.disabled,
      onMoveShouldSetPanResponder: () => !state.current.disabled,
      onPanResponderGrant: () => tick(),
      onPanResponderMove: (_, g) => {
        const m = state.current.max
        const dx = Math.max(0, g.dx)
        x.setValue(dx > m ? m + (dx - m) * 0.2 : dx)
      },
      onPanResponderRelease: (_, g) => {
        const m = state.current.max
        if (m > 0 && g.dx >= m * 0.8) {
          Animated.timing(x, { toValue: m, duration: 120, useNativeDriver: true }).start()
          state.current.onConfirm()
        } else {
          Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 8 }).start()
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(x, { toValue: 0, useNativeDriver: true }).start()
      },
    }),
  ).current

  useEffect(() => {
    if (!busy) Animated.spring(x, { toValue: 0, useNativeDriver: true }).start()
  }, [busy, x])

  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      accessibilityActions={[{ name: 'activate', label }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'activate' && !disabled && !busy) onConfirm()
      }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.track, { backgroundColor: colors.accentSoft, opacity: disabled ? 0.5 : 1 }]}
    >
      <Text weight={800} size={16} color="accentInk" style={{ paddingLeft: 40 }} numberOfLines={1}>
        {busy ? 'Recording…' : label}
      </Text>
      <Animated.View
        {...pan.panHandlers}
        style={[
          styles.thumb,
          {
            backgroundColor: colors.accent,
            shadowOpacity: isDark ? 0.5 : 0.32,
            transform: [{ translateX: Animated.add(x, nudge) }],
          },
        ]}
      >
        <Icons.arrowR color={colors.onAccent} size={22} />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  track: { height: 66, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  thumb: {
    position: 'absolute',
    left: PAD,
    top: PAD,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4A2BE0',
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
})
