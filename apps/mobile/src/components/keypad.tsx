import { useRef } from 'react'
import { Animated, Pressable, StyleSheet, View } from 'react-native'

import { Icons } from '@/components/icons'
import { RIPPLES, useRipple } from '@/components/ripple'
import { Text } from '@/components/text'
import { tick } from '@/lib/haptics'
import type { Key } from '@/lib/keypad'
import { useColors, useReduceMotion } from '@/theme'

const KEYS: Array<Key> = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del']

/** The amount keypad: 3×4 keys that press to 94% with a tick. */
export function Keypad({ onKey, height = 58 }: { onKey: (key: Key) => void; height?: number }) {
  return (
    <View style={styles.grid}>
      {[0, 3, 6, 9].map((start) => (
        <View key={start} style={styles.row}>
          {KEYS.slice(start, start + 3).map((key) => (
            <KeyButton key={key} value={key} onPress={() => onKey(key)} height={height} />
          ))}
        </View>
      ))}
    </View>
  )
}

function KeyButton({ value, onPress, height }: { value: Key; onPress: () => void; height: number }) {
  const colors = useColors()
  const reduce = useReduceMotion()
  const scale = useRef(new Animated.Value(1)).current
  const ripple = useRipple(colors.text, { strength: 0.12 })
  const to = (v: number) => {
    if (!reduce) Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 60, bounciness: 4 }).start()
  }
  return (
    <Animated.View style={[styles.cell, { transform: [{ scale }] }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={value === 'del' ? 'Delete' : value === '.' ? 'Decimal point' : value}
        onPress={() => {
          tick()
          onPress()
        }}
        onPressIn={() => to(0.94)}
        onPressOut={() => to(1)}
        android_ripple={ripple}
        style={({ pressed }) => [styles.key, { height, backgroundColor: pressed && !RIPPLES ? colors.surface3 : colors.key }]}
      >
        {value === 'del' ? (
          <Icons.del color={colors.text} size={24} />
        ) : (
          <Text display weight={600} size={26} lineHeight={30}>
            {value}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  grid: { gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  cell: { flex: 1 },
  key: { borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
})
