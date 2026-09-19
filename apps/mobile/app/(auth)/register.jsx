import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native'
import { Link, useLocalSearchParams, useRouter } from 'expo-router'
import { ErrorBanner } from '../../components/ErrorBanner.jsx'
import { PasswordStrengthBar } from '../../components/PasswordStrengthBar.jsx'
import { useAuthStore } from '../../store/auth.js'
import { useSettingsStore } from '../../store/settings.js'
import { colors, radii, spacing } from '../../constants/theme.js'

// Mirrors shared passwordSchema: >=12 chars, upper, lower, digit, symbol.
export function checkPassword(password) {
  if (password.length < 12) return 'Password must be at least 12 characters.'
  if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter.'
  if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter.'
  if (!/[0-9]/.test(password)) return 'Password must contain a number.'
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must contain a symbol.'
  return ''
}

export default function RegisterScreen() {
  const register = useAuthStore((s) => s.register)
  const router = useRouter()
  const { email: prefilled } = useLocalSearchParams()
  const timezone = useSettingsStore((s) => s.timezone)
  const baseCurrency = useSettingsStore((s) => s.baseCurrency)

  const [email, setEmail] = useState(typeof prefilled === 'string' ? prefilled : '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    setError('')
    const passwordError = checkPassword(password)
    if (passwordError) {
      setError(passwordError)
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (!privacyAccepted) {
      setError('You must accept the privacy policy to continue.')
      return
    }
    setBusy(true)
    try {
      await register({
        email: email.trim().toLowerCase(),
        password,
        confirmPassword,
        timezone,
        baseCurrency,
        privacyAccepted: true
      })
      router.replace({ pathname: '/(auth)/verify-email', params: { email } })
    } catch (err) {
      const status = err?.response?.status
      if (status === 409) setError('An account with that email already exists.')
      else if (status === 422 || status === 400) {
        setError(err?.response?.data?.error ?? 'Please check the details you entered.')
      } else setError('Registration failed. Check your connection and try again.')
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
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Start tracking in under a minute.</Text>

        <ErrorBanner message={error} />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />
        <PasswordStrengthBar password={password} />

        <Text style={styles.label}>Confirm password</Text>
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoCapitalize="none"
        />

        <Pressable style={styles.checkboxRow} onPress={() => setPrivacyAccepted(!privacyAccepted)}>
          <View style={[styles.checkbox, privacyAccepted && styles.checkboxOn]}>
            {privacyAccepted ? <Text style={styles.checkmark}>✓</Text> : null}
          </View>
          <Text style={styles.privacyText}>
            I have read and accept the privacy policy.
          </Text>
        </Pressable>

        <Pressable style={styles.submit} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Sign Up</Text>}
        </Pressable>

        <Link href="/(auth)/login" style={styles.link}>
          I already have an account
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingTop: 72 },
  title: { fontSize: 24, fontWeight: '600', color: colors.textPrimary },
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
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.lg },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  privacyText: { flex: 1, fontSize: 13, color: colors.textSecondary },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: spacing.xl
  },
  submitText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  link: { color: colors.primary, fontSize: 14, marginTop: spacing.xl, fontWeight: '600' }
})