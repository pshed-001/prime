import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import * as LocalAuthentication from 'expo-local-authentication'
import { useAuthStore } from '../../store/auth.js'
import { colors, radii, spacing } from '../../constants/theme.js'

export default function BiometricScreen() {
  const router = useRouter()
  const [available, setAvailable] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    LocalAuthentication.hasHardwareAsync()
      .then((h) => (h ? LocalAuthentication.isEnrolledAsync() : false))
      .then((enrolled) => setAvailable(enrolled))
  }, [])

  async function unlock() {
    setBusy(true)
    setError('')
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock PRIME',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false
      })
      if (result.success) {
        router.replace('/(tabs)')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.content}>
      <Text style={styles.emoji}>{available ? '🔓' : '🔒'}</Text>
      <Text style={styles.title}>Biometric unlock</Text>
      <Text style={styles.subtitle}>
        {available
          ? 'Use your fingerprint or face to unlock PRIME.'
          : 'No biometrics enrolled on this device. Sign in with your password instead.'}
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {available ? (
        <Pressable style={styles.submit} onPress={unlock} disabled={busy}>
          <Text style={styles.submitText}>{busy ? 'Checking...' : 'Unlock'}</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.submit} onPress={() => router.replace('/(auth)/login')}>
          <Text style={styles.submitText}>Use Password</Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl
  },
  emoji: { fontSize: 44, marginBottom: spacing.lg },
  title: { fontSize: 24, fontWeight: '600', color: colors.textPrimary },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl
  },
  error: { color: colors.warningRed, fontSize: 13, marginBottom: spacing.md },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 48
  },
  submitText: { color: '#fff', fontWeight: '600', fontSize: 15 }
})