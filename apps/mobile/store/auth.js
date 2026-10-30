import { create } from 'zustand'
import axios from 'axios'
import * as SecureStore from 'expo-secure-store'
import { apiClient, unwrap, BASE_URL } from '../lib/api.js'

const SECURE_STORE_OPTIONS = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
}

const BIOMETRIC_KEY = 'prime_biometric_enabled'

export async function isBiometricEnabled() {
  return (await SecureStore.getItemAsync(BIOMETRIC_KEY, SECURE_STORE_OPTIONS)) === '1'
}

// Wipe device data for the signed-out account so a later login on the same
// device never leaks the previous user's records (logout completeness).
async function clearLocalSession() {
  const { clearDatabase } = await import('../lib/database.js')
  await clearDatabase()
  const { useExpensesStore } = await import('./expenses.js')
  const { useAssetsStore } = await import('./assets.js')
  const { useTasksStore } = await import('./tasks.js')
  useExpensesStore.setState({ expenses: [], loaded: false })
  useAssetsStore.setState({ assets: [], loaded: false })
  useTasksStore.setState({ tasks: [], loaded: false })
}

export const useAuthStore = create((set, get) => ({
  user: null,
  hasSession: false,
  loading: true,

  async restore() {
    const token = await SecureStore.getItemAsync('prime_access_token', SECURE_STORE_OPTIONS)
    if (!token) {
      set({ hasSession: false, loading: false })
      return false
    }
    try {
      const res = await apiClient.get('/auth/me')
      set({ user: unwrap(res), hasSession: true, loading: false })
      return true
    } catch (err) {
      // Only drop local data when the token is genuinely rejected (not on a
      // transient offline blip - the app is offline-first).
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        await clearLocalSession()
      }
      set({ hasSession: false, loading: false })
      return false
    }
  },

  async login(email, password) {
    const res = await apiClient.post('/auth/login', { email, password })
    const { accessToken, refreshToken, user } = res.data.data
    await SecureStore.setItemAsync('prime_access_token', accessToken, SECURE_STORE_OPTIONS)
    await SecureStore.setItemAsync('prime_refresh_token', refreshToken, SECURE_STORE_OPTIONS)
    set({ user, hasSession: true })
    return user
  },

  async register(payload) {
    // Contract (shared registerSchema): email, password, confirmPassword,
    // timezone, baseCurrency, privacyAccepted.
    const res = await apiClient.post('/auth/register', payload)
    return res.data.data
  },

  async verifyEmail(token) {
    const res = await apiClient.get('/auth/verify-email', { params: { token } })
    return res.data.data
  },

  async resetPassword(token, newPassword) {
    await apiClient.post('/auth/reset-password', { token, newPassword })
  },

  async logout() {
    // Revoke the token family server-side first (best effort). Uses a raw
    // axios call so the refresh interceptor can't re-enter and recurse.
    try {
      const token = await SecureStore.getItemAsync('prime_access_token', SECURE_STORE_OPTIONS)
      if (token) {
        await axios.post(
          `${BASE_URL}/auth/logout`,
          {},
          {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 8000
          }
        )
      }
    } catch {
      // Offline or expired token - local sign-out still proceeds.
    }
    await SecureStore.deleteItemAsync('prime_access_token', SECURE_STORE_OPTIONS)
    await SecureStore.deleteItemAsync('prime_refresh_token', SECURE_STORE_OPTIONS)
    await clearLocalSession()
    set({ user: null, hasSession: false })
  },

  // Called by the API client when a refresh fails; the token is already dead
  // so there is nothing to revoke server-side.
  async sessionExpired() {
    await SecureStore.deleteItemAsync('prime_access_token', SECURE_STORE_OPTIONS)
    await SecureStore.deleteItemAsync('prime_refresh_token', SECURE_STORE_OPTIONS)
    await clearLocalSession()
    set({ user: null, hasSession: false })
  },

  async setBiometricEnabled(enabled) {
    if (enabled) {
      await SecureStore.setItemAsync(BIOMETRIC_KEY, '1', SECURE_STORE_OPTIONS)
    } else {
      await SecureStore.deleteItemAsync(BIOMETRIC_KEY, SECURE_STORE_OPTIONS)
    }
  }
}))