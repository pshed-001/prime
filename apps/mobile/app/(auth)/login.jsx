import { useMemo, useState } from 'react'
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
import { Ionicons } from '@expo/vector-icons'
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg'
import { Link, useRouter } from 'expo-router'
import { ErrorBanner } from '../../components/ErrorBanner.jsx'
import { useAuthStore } from '../../store/auth.js'
import { radii, spacing, useTheme } from '../../constants/theme.js'

export default function LoginScreen() {
  const login = useAuthStore((s) => s.login)
  const router = useRouter()
  const colors = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.hero}>
          <Svg style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="heroGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={colors.primary} />
                <Stop offset="100%" stopColor={colors.secondary} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroGradient)" />
          </Svg>
          <View style={styles.heroBadge}>
            <Ionicons name="wallet-outline" size={24} color="#ffffff" />
          </View>
          <Text style={styles.brand}>PRIME</Text>
          <Text style={styles.tagline}>Wealth in your wallet, order in your life.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome back</Text>
          <Text style={styles.cardSubtitle}>Sign in to see your balance, budget and tasks.</Text>

          <ErrorBanner message={error} />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor={colors.textSecondary}
            autoComplete="email"
          />

          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordWrap}>
            <TextInput
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoComplete="password"
            />
            <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={10} style={styles.eye}>
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.textSecondary}
              />
            </Pressable>
          </View>

          <Pressable style={styles.submit} onPress={submit} disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitText}>Sign In</Text>
            )}
          </Pressable>

          <View style={styles.foot}>
            <Text style={styles.footText}>New to PRIME?</Text>
            <Link href="/(auth)/register" style={styles.link}>
              Create an account
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const createStyles = (colors) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    content: { paddingBottom: spacing.xxl },
    hero: {
      height: 232,
      justifyContent: 'flex-end',
      padding: spacing.xl,
      overflow: 'hidden'
    },
    heroBadge: {
      position: 'absolute',
      top: 48,
      right: spacing.xl,
      width: 44,
      height: 44,
      borderRadius: radii.lg,
      backgroundColor: 'rgba(255,255,255,0.18)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.35)',
      alignItems: 'center',
      justifyContent: 'center'
    },
    brand: { fontSize: 40, fontWeight: '800', color: '#ffffff', letterSpacing: 1 },
    tagline: { fontSize: 14, color: 'rgba(255,255,255,0.92)', marginTop: 6 },
    card: {
      marginTop: -spacing.xl,
      marginHorizontal: spacing.lg,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radii.lg,
      padding: spacing.xl
    },
    cardTitle: { fontSize: 22, fontWeight: '700', color: colors.textPrimary },
    cardSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 4, marginBottom: spacing.md },
    label: { fontSize: 12, color: colors.textSecondary, marginBottom: 4, marginTop: 12 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.textPrimary,
      backgroundColor: colors.background
    },
    passwordWrap: { flexDirection: 'row', alignItems: 'center' },
    passwordInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.textPrimary,
      backgroundColor: colors.background
    },
    eye: { position: 'absolute', right: 12, padding: 2 },
    submit: {
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      alignItems: 'center',
      paddingVertical: 12,
      marginTop: spacing.xl
    },
    submitText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
    foot: { flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: spacing.lg },
    footText: { fontSize: 14, color: colors.textSecondary },
    link: { fontSize: 14, color: colors.primary, fontWeight: '700' }
  })