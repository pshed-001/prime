import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../constants/theme.js'

function tabIcon(name) {
  return ({ color, size }) => <Ionicons name={name} color={color} size={size} />
}

export default function TabsLayout() {
  const palette = useTheme()

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerTintColor: palette.textPrimary,
        headerStyle: { backgroundColor: palette.background },
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.textSecondary,
        tabBarStyle: { backgroundColor: palette.background, borderTopColor: palette.border }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Dashboard', tabBarIcon: tabIcon('speedometer-outline') }}
      />
      <Tabs.Screen
        name="live"
        options={{ title: 'Markets', tabBarIcon: tabIcon('trending-up-outline') }}
      />
      <Tabs.Screen
        name="expenses"
        options={{ title: 'Records', tabBarIcon: tabIcon('receipt-outline') }}
      />
      <Tabs.Screen
        name="tasks"
        options={{ title: 'Tasks', tabBarIcon: tabIcon('checkmark-done-outline') }}
      />
      <Tabs.Screen
        name="assets"
        options={{ title: 'Assets', tabBarIcon: tabIcon('wallet-outline') }}
      />
      <Tabs.Screen
        name="reports"
        options={{ title: 'Reports', tabBarIcon: tabIcon('bar-chart-outline') }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarIcon: tabIcon('settings-outline') }}
      />
    </Tabs>
  )
}