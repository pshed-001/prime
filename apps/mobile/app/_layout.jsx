import { useEffect } from 'react'
import { ActivityIndicator, AppState, View } from 'react-native'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import * as Notifications from 'expo-notifications'
import { useAuthStore } from '../store/auth.js'
import { useSettingsStore } from '../store/settings.js'
import { useSyncStore } from '../store/sync.js'
import { startAutoSync, stopAutoSync } from '../lib/sync.js'
import { registerMidnightTask, generatePreviousDayReport } from '../lib/midnight.js'
import { colors } from '../constants/theme.js'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false
  })
})

export default function RootLayout() {
  const { hasSession, loading, restore } = useAuthStore()
  const loadSettings = useSettingsStore((s) => s.load)
  const refreshCounts = useSyncStore((s) => s.refreshCounts)
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    restore()
    loadSettings()
    refreshCounts()
    registerMidnightTask()
  }, [])

  // 6.1.1: daily report for the previous day is generated on every foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && hasSession) generatePreviousDayReport()
    })
    return () => sub.remove()
  }, [hasSession])

  useEffect(() => {
    if (hasSession) startAutoSync()
    else stopAutoSync()
  }, [hasSession])

  useEffect(() => {
    if (loading) return
    const inAuthGroup = segments[0] === '(auth)'
    if (!hasSession && !inAuthGroup) router.replace('/(auth)/login')
    else if (hasSession && inAuthGroup) router.replace('/(tabs)')
  }, [hasSession, loading, segments])

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      router.push('/(tabs)/reports')
    })
    return () => sub.remove()
  }, [])

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="sync-status"
          options={{ headerShown: true, title: 'Sync Status', presentation: 'modal' }}
        />
      </Stack>
    </GestureHandlerRootView>
  )
}