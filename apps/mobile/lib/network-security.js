// Transport-security posture for the API client (blueprint 9.1 / 9.3).
//
// Pure module - no RN/expo imports so it can be unit-tested in Node.

export const DEV_HTTP_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '10.0.2.2', '10.0.3.2'])

export function parseBaseUrl(url) {
  const m = /^(https?):\/\/([^/:]+)/.exec(url ?? '')
  if (!m) return null
  return { scheme: m[1], host: m[2].toLowerCase() }
}

// Fails closed in production: only https is accepted, except the loopback /
// emulator aliases that are needed to reach a local dev API from a debug or
// test build. Never returns ok:true for a clear-text external API.
export function assertSecureEndpoint(url, { production }) {
  const info = parseBaseUrl(url)
  if (!info) return { ok: false, reason: 'invalid-or-non-http-url' }
  if (info.scheme === 'https') return { ok: true }
  if (!production) return { ok: true, insecure: true }
  if (DEV_HTTP_HOSTS.has(info.host)) return { ok: true, insecure: true }
  return { ok: false, reason: `clear-text-api (http://${info.host}) exposed in a production build` }
}