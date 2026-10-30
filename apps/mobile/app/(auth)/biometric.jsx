import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import * as LocalAuthentication from 'expo-local-authentication'
import { useAuthStore } from '../../store/auth.js'
import { radii, spacing, useTheme } from '../../constants/theme.js'

export default function BiometricScreen() {
  const router = useRouter()
  const sessionExpired = useAuthStore((s) => s.sessionExpired)
  const colors = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])

  const [available, setAvailable] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const promptedRef = useRef(false)

  useEffect(() => {
    let active = true
    LocalAuthentication.supportedAuthenticationTypesAsync()
      .then((types) => {
        if (types.length === 0 && active) {
          setAvailable(false)
        }
      })
      .catch(() => {})
    LocalAuthentication.hasHardwareAsync()
      .then((h) => (h ? LocalAuthentication.isEnrolledAsync() : false))
      .then((enrolled) => {
        if (!active) return
        setAvailable(enrolled)
        if (enrolled && !promptedRef.current) {
          promptedRef.current = true
          unlock()
        }
      })
      .catch(() => {
        if (active) setAvailable(false)
      })
    return () => {
      active = false
    }
  }, [])

  const unlock = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock PRIME with your fingerprint or face',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false
      })
      if (result.success) {
        router.replace('/(tabs)')
      } else {
        setError('Authentication cancelled. Try again or sign in with your password.')
      }
    } catch {
      setError('Biometric authentication is unavailable. Use your password instead.')
    } finally {
      setBusy(false)
    }
  }, [router])

  async function usePassword() {
    await sessionExpired()
    router.replace('/(auth)/login')
  }

  if (available === null) {
    return (
      <View style={styles.content}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  return (
    <View style={styles.content}>
      <View style={styles.iconCircle}>
        <Text style={styles.emoji}>{available ? '🔓' : '🔒'}</Text>
      </View>
      <Text style={styles.title}>Biometric unlock</Text>
      <Text style={styles.subtitle}>
        {available
          ? 'Use your fingerprint or face to unlock PRIME.'
          : 'No biometrics are enrolled on this device. Sign in with your password instead.'}
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {available ? (
        <Pressable style={styles.submit} onPress={unlock} disabled={busy}>
          <Text style={styles.submitText}>{busy ? 'Checking...' : 'Unlock'}</Text>
        </Pressable>
      ) : null}

      <Pressable style={styles.passwordBtn} onPress={usePassword}>
        <Text style={styles.passwordText}>Use password</Text>
      </Pressable>
    </View>
  )
}

const createStyles = (colors) =>
  StyleSheet.create({
    content: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl
    },
    iconCircle: {
      width: 72,
      height: 72,
      borderRadius: radii.lg,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      opacity: 0.9
    },
    emoji: { fontSize: 34 },
    title: { fontSize: 24, fontWeight: '700', color: colors.textPrimary, marginTop: spacing.lg },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.sm,
      marginBottom: spacing.xl,
      maxWidth: 280
    },
    error: { color: colors.warningRed, fontSize: 13, marginBottom: spacing.md, textAlign: 'center' },
    submit: {
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 48
    },
    submitText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
    passwordBtn: { marginTop: spacing.lg, paddingHorizontal: 16, paddingVertical: 8 },
    passwordText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' }
  })