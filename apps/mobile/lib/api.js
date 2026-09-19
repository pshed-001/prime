// API client with JWT attachment, transparent refresh, and certificate
// pinning config (blueprint 9.1 / 9.3).
import axios from 'axios'
import * as SecureStore from 'expo-secure-store'
import { getDeviceFingerprint } from './device.js'

const SECURE_STORE_OPTIONS = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
}

// How to generate a pin hash:
//   openssl s_client -connect api.prime.itgel.com:443 \
//     | openssl x509 -pubkey -noout \
//     | openssl pkey -pubin -outform der \
//     | openssl dgst -sha256 -binary | base64
// MOB-05: minimum two pins - current leaf + intermediate CA backup.
const PINNED_CERTS = [
  'sha256/REPLACE_WITH_LEAF_CERT_HASH',
  'sha256/REPLACE_WITH_INTERMEDIATE_CA_HASH'
]

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api'

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
      useAuthStore.getState().logout()
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