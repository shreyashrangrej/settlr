import { formatMoney } from '@settlr/shared/format'
import { StyleSheet, View } from 'react-native'

import { Placeholder, Screen } from '@/components/screen'
import { Text } from '@/components/text'

export default function HomeScreen() {
  return (
    <Screen title="Home" subtitle="Settlr">
      <Placeholder>
        <Text size={14} weight={500} color="muted">
          Net balance
        </Text>
        <Text mono size={40} weight={600} style={styles.hero}>
          {formatMoney(482000, 'INR')}
        </Text>
        <View style={styles.row}>
          <Text mono size={17} weight={500} color="owed">
            +{formatMoney(735000, 'INR')}
          </Text>
          <Text mono size={17} weight={500} color="owe">
            {formatMoney(-253000, 'INR')}
          </Text>
        </View>
        <Text size={13} color="faint">
          Sample numbers. Your balances arrive in a later phase.
        </Text>
      </Placeholder>
    </Screen>
  )
}

const styles = StyleSheet.create({
  hero: { letterSpacing: -2, lineHeight: 48 },
  row: { flexDirection: 'row', gap: 16 },
})
