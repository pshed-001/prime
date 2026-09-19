// Currency formatting. Rule MOB-08: currency code always shown beside the
// number. Bare numbers are never displayed.
export function formatMoney(amount, currency = 'NGN', { zeroAs = null } = {}) {
  const n = Number(amount)
  if (Number.isNaN(n)) return `${currency} 0.00`
  if (n === 0 && zeroAs != null) return zeroAs
  const formatted = n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
  return `${currency} ${formatted}`
}

export function timeAgo(date) {
  const then = new Date(date).getTime()
  if (Number.isNaN(then)) return 'unknown'
  const seconds = Math.round((Date.now() - then) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days} days ago`
}

export function todayInTimezone(timezone = 'Africa/Lagos') {
  return dateInTimezone(timezone, new Date())
}

// Local YYYY-MM-DD for an arbitrary instant in the given IANA timezone.
function dateInTimezone(timezone, date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  return `${values.year}-${values.month}-${values.day}`
}

// Local YYYY-MM-DD for the previous calendar day in the user's timezone.
// Computed from local noon to avoid DST boundary jump/duplicate days (6.1.1).
export function previousDayInTimezone(timezone = 'Africa/Lagos', now = new Date()) {
  const today = dateInTimezone(timezone, now)
  const noon = new Date(`${today}T12:00:00Z`)
  noon.setUTCDate(noon.getUTCDate() - 1)
  return dateInTimezone(timezone, noon)
}

export function timeOfDay(datetime) {
  const d = new Date(datetime)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// Build an RFC3339 datetime that keeps the wall-clock of the user-provided
// date (YYYY-MM-DD) in the device's local timezone. The server's expense/task
// schemas require z.string().datetime() (valid offset), and we deliberately
// preserve the local offset so day-splitting stays aligned with the calendar.
function localDeviceOffset() {
  const minutes = -new Date().getTimezoneOffset()
  const sign = minutes >= 0 ? '+' : '-'
  const abs = Math.abs(minutes)
  const hh = String(Math.floor(abs / 60)).padStart(2, '0')
  const mm = String(abs % 60).padStart(2, '0')
  return `${sign}${hh}:${mm}`
}

export function toLocalDateTime(dateOnly, time = '00:00:00') {
  if (!dateOnly) return null
  return `${dateOnly}T${time}${localDeviceOffset()}`
}