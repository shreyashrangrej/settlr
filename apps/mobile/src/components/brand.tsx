import { StyleSheet, View } from 'react-native'
import Svg, { Circle, Path, Rect } from 'react-native-svg'

import { Text } from '@/components/text'
import { useColors } from '@/theme'

/** The Settlr mark and wordmark from sign-in.html. */
export function Brand() {
  const colors = useColors()
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="Settlr">
      <Svg width={40} height={40} viewBox="0 0 32 32">
        <Rect width={32} height={32} rx={10} fill={colors.accent} />
        <Path d="M10 22 22 10" stroke={colors.onAccent} strokeWidth={2.6} strokeLinecap="round" />
        <Circle cx={11.5} cy={11.5} r={2.6} fill={colors.onAccent} />
        <Circle cx={20.5} cy={20.5} r={2.6} fill={colors.onAccent} />
      </Svg>
      <Text size={26} weight={700} style={styles.word}>
        settlr
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  word: { letterSpacing: -1.2, lineHeight: 32 },
})
