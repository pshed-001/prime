// Device fingerprint persisted once in expo-secure-store. Sent on every
// request as X-Device-ID (design doc 9.5 - fake client defence).
import * as SecureStore from 'expo-secure-store'
import { uuidv7 } from '../utils/uuid.js'

const SECURE_STORE_OPTIONS = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
}

let cached = null

export async function getDeviceFingerprint() {
  if (cached) return cached
  let id = await SecureStore.getItemAsync('prime_device_id', SECURE_STORE_OPTIONS)
  if (!id) {
    id = uuidv7()
    await SecureStore.setItemAsync('prime_device_id', id, SECURE_STORE_OPTIONS)
  }
  cached = id
  return id
}