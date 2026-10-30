import { useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Link, useLocalSearchParams } from 'expo-router'
import { ErrorBanner } from '../../components/ErrorBanner.jsx'
import { useAuthStore } from '../../store/auth.js'
import { radii, spacing, useTheme } from '../../constants/theme.js'

// Verification is token-based: the email link hits GET /api/auth/verify-email?token=....
// The app deep-links by token on iOS; on Android the token can be pasted here.
export default function VerifyEmailScreen() {
  const { email, token } = useLocalSearchParams()
  const verifyEmail = useAuthStore((s) => s.verifyEmail)
  const colors = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const [tokenInput, setTokenInput] = useState(typeof token === 'string' ? token : '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function submit() {
    setError('')
    if (!tokenInput.trim()) {
      setError('Enter the code from your verification email.')
      return
    }
    setBusy(true)
    try {
      await verifyEmail(tokenInput.trim())
      setDone(true)
    } catch (err) {
      const status = err?.response?.status
      if (status === 400) setError('That code is invalid or has expired.')
      else if (status === 429) setError('Too many attempts. Try again in a few minutes.')
      else setError('Verification failed. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.content}>
      <Text style={styles.title}>Verify your email</Text>
      <Text style={styles.subtitle}>
        We sent a verification link to {email ?? 'your inbox'}. Open it in your email app, or paste
        the code from the link below.
      </Text>

      <ErrorBanner message={error} />

      {done ? (
        <Text style={styles.done}>Email verified. You can now sign in.</Text>
      ) : (
        <>
          <TextInput
            style={styles.input}
            value={tokenInput}
            onChangeText={setTokenInput}
            autoCapitalize="none"
            placeholder="paste verification code"
            placeholderTextColor={colors.textSecondary}
          />
          <Pressable style={styles.submit} onPress={submit} disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitText}>Verify</Text>
            )}
          </Pressable>
        </>
      )}

      <Link href="/(auth)/login" style={styles.link}>
        Go to Sign In
      </Link>
    </View>
  )
}

const createStyles = (colors) =>
  StyleSheet.create({
    content: { flex: 1, backgroundColor: colors.background, padding: spacing.xl, paddingTop: 72 },
    title: { fontSize: 24, fontWeight: '600', color: colors.textPrimary },
    subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4, marginBottom: spacing.xl },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: 12,
      paddingVertical: 12,
      fontSize: 14,
      color: colors.textPrimary,
      backgroundColor: colors.surface
    },
    submit: {
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      alignItems: 'center',
      paddingVertical: 12,
      marginTop: spacing.xl
    },
    submitText: { color: '#ffffff', fontWeight: '600', fontSize: 15 },
    done: { fontSize: 15, color: colors.successGreen, marginBottom: spacing.lg },
    link: { color: colors.primary, fontSize: 14, marginTop: spacing.xl, fontWeight: '600' }
  })