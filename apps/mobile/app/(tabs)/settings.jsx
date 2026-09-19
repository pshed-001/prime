import { useEffect } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SyncStatusBar } from '../../components/SyncStatusBar.jsx'
import { useAuthStore } from '../../store/auth.js'
import { useSettingsStore } from '../../store/settings.js'
import { useSyncStore } from '../../store/sync.js'
import { getDb } from '../../lib/database.js'
import { runOnce } from '../../lib/sync.js'
import { currencyList } from '../../constants/categories.js'
import { colors, radii, spacing } from '../../constants/theme.js'

const THEMES = ['system', 'light', 'dark']
const TIMEZONES = ['Africa/Lagos', 'Africa/Accra', 'Africa/Nairobi', 'Europe/London', 'America/New_York']

export default function SettingsScreen() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const settings = useSettingsStore()
  const sync = useSyncStore()
  const deadLettered = sync.deadLettered

  useEffect(() => {
    sync.refreshCounts()
  }, [])

  async function handleLogout() {
    Alert.alert('Sign out', 'You will need to log in again on this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await logout()
          const db = await getDb()
          await db.execAsync('DELETE FROM sync_queue;')
          router.replace('/(auth)/login')
        }
      }
    ])
  }

  async function handleRetry() {
    await runOnce({ manual: true })
    sync.refreshCounts()
  }

  async function handleDiscardAll() {
    Alert.alert(
      'Discard failed changes',
      'All dead-lettered changes will be permanently removed from this device. The server copy is unaffected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            const db = await getDb()
            await db.runAsync('DELETE FROM sync_queue WHERE dead_lettered = 1')
            sync.refreshCounts()
          }
        }
      ]
    )
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <SyncStatusBar onPress={handleRetry} />

      <Section title="Account">
        <Text style={styles.caption}>{user?.name ?? 'Signed in'}</Text>
        <Text style={styles.caption}>{user?.email ?? ''}</Text>
        <Pressable style={styles.rowPress} onPress={() => router.push('/(auth)/biometric')}>
          <Text style={styles.rowText}>Biometric unlock</Text>
        </Pressable>
      </Section>

      <Section title="Preferences">
        <Text style={styles.label}>Theme</Text>
        <View style={styles.chips}>
          {THEMES.map((t) => (
            <Pressable
              key={t}
              onPress={() => settings.update({ theme: t })}
              style={[styles.chip, settings.theme === t && styles.chipActive]}
            >
              <Text style={[styles.chipText, settings.theme === t && styles.chipTextActive]}>
                {t}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Base currency</Text>
        <View style={styles.chips}>
          {currencyList.slice(0, 6).map((c) => (
            <Pressable
              key={c}
              onPress={() => settings.update({ baseCurrency: c })}
              style={[styles.chip, settings.baseCurrency === c && styles.chipActive]}
            >
              <Text style={[styles.chipText, settings.baseCurrency === c && styles.chipTextActive]}>
                {c}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Timezone (report day boundary)</Text>
        <View style={styles.chips}>
          {TIMEZONES.map((tz) => (
            <Pressable
              key={tz}
              onPress={() => settings.update({ timezone: tz })}
              style={[styles.chip, settings.timezone === tz && styles.chipActive]}
            >
              <Text style={[styles.chipText, settings.timezone === tz && styles.chipTextActive]}>
                {tz}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.row, { marginTop: spacing.md }]}>
          <Text style={styles.rowText}>
            Daily budget: {settings.dailyBudget} {settings.baseCurrency}
          </Text>
          <View style={styles.stepper}>
            <Pressable
              style={styles.stepButton}
              onPress={() => settings.update({ dailyBudget: Math.max(0, settings.dailyBudget - 1000) })}
            >
              <Text style={styles.stepText}>−</Text>
            </Pressable>
            <Pressable
              style={styles.stepButton}
              onPress={() => settings.update({ dailyBudget: settings.dailyBudget + 1000 })}
            >
              <Text style={styles.stepText}>+</Text>
            </Pressable>
          </View>
        </View>
      </Section>

      <Section title="Privacy">
        <View style={styles.row}>
          <View style={styles.middle}>
            <Text style={styles.rowText}>Allow AI features</Text>
            <Text style={styles.caption}>Enables intelligent suggestions (HIPA-compliant).</Text>
          </View>
          <Switch
            value={settings.aiConsentGiven}
            onValueChange={(v) => settings.update({ aiConsentGiven: v })}
          />
        </View>
      </Section>

      <Section title="Sync">
        {deadLettered > 0 ? (
          <>
            <Text style={styles.caption}>
              {deadLettered} change{deadLettered > 1 ? 's' : ''} failed to sync. You can retry or
              discard them.
            </Text>
            <View style={styles.rowDouble}>
              <Pressable style={styles.button} onPress={handleRetry}>
                <Text style={styles.buttonText}>Retry</Text>
              </Pressable>
              <Pressable style={[styles.button, styles.buttonDanger]} onPress={handleDiscardAll}>
                <Text style={styles.buttonText}>Discard all</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Text style={styles.caption}>All changes synced.</Text>
        )}
      </Section>

      <Pressable style={styles.logout} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </Pressable>
    </ScrollView>
  )
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 48 },
  section: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8
  },
  label: { fontSize: 12, color: colors.textSecondary, marginTop: 12 },
  caption: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.background
  },
  chipActive: { borderColor: colors.primary },
  chipText: { fontSize: 12, color: colors.textSecondary },
  chipTextActive: { color: colors.primary, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  rowPress: { paddingVertical: 8 },
  rowDouble: { flexDirection: 'row', gap: 8, marginTop: 8 },
  middle: { flex: 1 },
  rowText: { fontSize: 14, color: colors.textPrimary },
  button: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.md,
    alignItems: 'center',
    paddingVertical: 10
  },
  buttonText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  buttonDanger: { borderColor: colors.warningRed },
  stepper: { flexDirection: 'row', gap: 8 },
  stepButton: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background
  },
  stepText: { fontSize: 18, color: colors.textPrimary },
  logout: {
    borderWidth: 1,
    borderColor: colors.warningRed,
    borderRadius: radii.md,
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: spacing.sm
  },
  logoutText: { color: colors.warningRed, fontWeight: '600', fontSize: 15 }
})