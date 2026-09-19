export function deviceFingerprint(req, _res, next) {
  const header = req.headers['x-device-id']
  if (typeof header === 'string' && header.length > 0) {
    req.deviceId = header.slice(0, 128)
  }
  return next()
}