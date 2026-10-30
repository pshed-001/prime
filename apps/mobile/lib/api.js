// API client with JWT attachment, transparent refresh, and a fail-closed
// transport-security guard (blueprint 9.1 / 9.3).
import axios from 'axios'
import * as SecureStore from 'expo-secure-store'
import { getDeviceFingerprint } from './device.js'
import { assertSecureEndpoint } from './network-security.js'

const SECURE_STORE_OPTIONS = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
}

// React Native's fetch/axios stack cannot inspect server certificates from JS,
// so TLS is verified by the OS and public-key pinning is NOT enforced here.
// To add real pinning later, install a native module (react-native-ssl-pinning)
// and rebuild. This array is the single agreed source for that provider's pin
// set, supplied via EXPO_PUBLIC_API_PINS (comma-separated "sha256/<base64>"
// hashes produced from the leaf/intermediate public keys).
const PINNED_CERTS = (process.env.EXPO_PUBLIC_API_PINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter((s) => /^sha256\/[A-Za-z0-9+/=]+$/.test(s))

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api'

// Fail closed in production builds: refuse a clear-text external API endpoint
// at module load. LOCAL / emulator http aliases stay available for debug
// builds running against a machine-local API.
const isProductionBuild = typeof __DEV__ === 'undefined' ? true : !__DEV__
if (isProductionBuild) {
  const check = assertSecureEndpoint(BASE_URL, { production: true })
  if (!check.ok) {
    throw new Error(`[api] refusing to start: ${check.reason}`)
  }
}

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
})

// Attach JWT + device fingerprint to every request.
apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('prime_access_token', SECURE_STORE_OPTIONS)
  if (token) config.headers.Authorization = `Bearer ${token}`
  config.headers['X-Device-ID'] = await getDeviceFingerprint()
  return config
})

let refreshing = null

// Handle 401 transparently with a single in-flight refresh.
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    if (error.response?.status !== 401 || original?._retry) {
      return Promise.reject(error)
    }
    original._retry = true

    if (!refreshing) {
      refreshing = (async () => {
        const refreshToken = await SecureStore.getItemAsync(
          'prime_refresh_token',
          SECURE_STORE_OPTIONS
        )
        if (!refreshToken) throw new Error('no refresh token')
        const res = await axios.post(
          `${BASE_URL}/auth/refresh`,
          {},
          { headers: { Authorization: `Bearer ${refreshToken}` } }
        )
        const { accessToken, refreshToken: newRefresh } = res.data.data
        await SecureStore.setItemAsync('prime_access_token', accessToken, SECURE_STORE_OPTIONS)
        await SecureStore.setItemAsync('prime_refresh_token', newRefresh, SECURE_STORE_OPTIONS)
        return accessToken
      })().finally(() => {
        refreshing = null
      })
    }

    try {
      const accessToken = await refreshing
      original.headers.Authorization = `Bearer ${accessToken}`
      return apiClient(original)
    } catch (refreshError) {
      const { useAuthStore } = await import('../store/auth.js')
      useAuthStore.getState().sessionExpired()
      return Promise.reject(refreshError)
    }
  }
)

export { PINNED_CERTS, BASE_URL }

// Unwrap the standard envelope { success, data, error, code }.
export function unwrap(response) {
  const body = response.data
  return body.data
}