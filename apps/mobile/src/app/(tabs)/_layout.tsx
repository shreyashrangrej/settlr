import { Tabs } from 'expo-router'

import { TabBar } from '@/components/tab-bar'
import { useColors } from '@/theme'

export default function TabLayout() {
  const colors = useColors()
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="groups" options={{ title: 'Groups' }} />
      <Tabs.Screen name="friends" options={{ title: 'Friends' }} />
      <Tabs.Screen name="spending" options={{ title: 'Spending' }} />
    </Tabs>
  )
}
