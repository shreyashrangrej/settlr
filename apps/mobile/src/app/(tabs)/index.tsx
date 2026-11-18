import { formatMoney } from '@settlr/shared/format'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { AccountAvatar, AccountCard, useCurrentUser } from '@/components/account-button'
import { Placeholder, Screen } from '@/components/screen'
import { Text } from '@/components/text'

export default function HomeScreen() {
  const { name } = useCurrentUser()
  const [accountOpen, setAccountOpen] = useState(false)
  const firstName = name.split(/\s+/)[0]

  return (
    <Screen
      title={firstName ? `Hi, ${firstName}` : 'Home'}
      subtitle="Settlr"
      actions={<AccountAvatar open={accountOpen} onPress={() => setAccountOpen((open) => !open)} />}
    >
      {accountOpen ? <AccountCard /> : null}
      <Placeholder>
        <Text size={14} weight={500} color="muted">
          Net balance
        </Text>
        <Text tabular size={40} weight={600} style={styles.hero}>
          {formatMoney(482000, 'INR')}
        </Text>
        <View style={styles.row}>
          <Text tabular size={18} weight={500} color="owed">
            +{formatMoney(735000, 'INR')}
          </Text>
          <Text tabular size={18} weight={500} color="owe">
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
  hero: { letterSpacing: -1.2, lineHeight: 48 },
  row: { flexDirection: 'row', gap: 16 },
})
