import { useEffect, useState } from 'react'
import { ActivityIndicator, AppState, View } from 'react-native'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
// import * as Notifications from 'expo-notifications'
import { useAuthStore, isBiometricEnabled } from '../store/auth.js'
import { useSettingsStore } from '../store/settings.js'
import { useSyncStore } from '../store/sync.js'
import { startAutoSync, stopAutoSync } from '../lib/sync.js'
import { registerMidnightTask, generatePreviousDayReport } from '../lib/midnight.js'
import { useTheme, useIsDark } from '../constants/theme.js'
/*
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false
  })
})
*/
export default function RootLayout() {
  const { hasSession, loading, restore } = useAuthStore()
  const loadSettings = useSettingsStore((s) => s.load)
  const refreshCounts = useSyncStore((s) => s.refreshCounts)
  const segments = useSegments()
  const router = useRouter()
  const colors = useTheme()
  const isDark = useIsDark()

  // Whether this device has biometric unlock enabled for the signed-in user.
  const [biometric, setBiometric] = useState(false)

  useEffect(() => {
    restore()
    loadSettings()
    refreshCounts()
    registerMidnightTask()
  }, [])

  useEffect(() => {
    let active = true
    isBiometricEnabled().then((enabled) => {
      if (active) setBiometric(enabled)
    })
    return () => {
      active = false
    }
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
    else if (hasSession && inAuthGroup) {
      // Users who opted into biometric unlock re-gate once per launch or on
      // sign-in; the biometric screen handles success/cancel itself.
      if (biometric && segments[1] !== 'biometric') router.replace('/(auth)/biometric')
      else router.replace('/(tabs)')
    }
  }, [hasSession, loading, segments, biometric])
/*
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      router.push('/(tabs)/reports')
    })
    return () => sub.remove()
  }, [])
*/
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
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