import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { apiClient, unwrap } from '../lib/api.js'

const SECURE_STORE_OPTIONS = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
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
    } catch {
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
    await SecureStore.deleteItemAsync('prime_access_token', SECURE_STORE_OPTIONS)
    await SecureStore.deleteItemAsync('prime_refresh_token', SECURE_STORE_OPTIONS)
    set({ user: null, hasSession: false })
  }
}))