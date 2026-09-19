import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput
} from 'react-native'
import { Link, useRouter } from 'expo-router'
import { ErrorBanner } from '../../components/ErrorBanner.jsx'
import { useAuthStore } from '../../store/auth.js'
import { colors, radii, spacing } from '../../constants/theme.js'

export default function LoginScreen() {
  const login = useAuthStore((s) => s.login)
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    setError('')
    setBusy(true)
    try {
      await login(email.trim().toLowerCase(), password)
      router.replace('/(tabs)')
    } catch (err) {
      const code = err?.response?.data?.code
      const status = err?.response?.status
      if (status === 403 && code === 'EMAIL_NOT_VERIFIED') {
        router.push({ pathname: '/(auth)/verify-email', params: { email } })
      } else if (status === 423 || code === 'ACCOUNT_LOCKED') {
        setError('Account temporarily locked. Try again in 10 minutes.')
      } else if (status === 429) {
        setError('Too many attempts. Please wait a few minutes and try again.')
      } else if (status === 401) {
        setError('Invalid email or password.')
      } else {
        setError('Could not sign in. Check your connection and try again.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand}>PRIME</Text>
        <Text style={styles.subtitle}>Personal finance and productivity.</Text>

        <ErrorBanner message={error} />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor="#9ca3af"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor="#9ca3af"
        />

        <Pressable style={styles.submit} onPress={submit} disabled={busy}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Sign In</Text>
          )}
        </Pressable>

        <Text style={styles.caption}>
          Biometric unlock is available on the next screen (link under Settings).
        </Text>

        <Link href="/(auth)/register" style={styles.link}>
          Create an account
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingTop: 72 },
  brand: { fontSize: 32, fontWeight: '700', color: colors.primary },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4, marginBottom: spacing.xl },
  label: { fontSize: 12, color: colors.textSecondary, marginBottom: 4, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
  submitText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  caption: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.lg },
  link: { color: colors.primary, fontSize: 14, marginTop: spacing.xl, fontWeight: '600' }
})