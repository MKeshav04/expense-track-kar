// All dates are local calendar days stored as 'YYYY-MM-DD' strings.

const pad = (n) => String(n).padStart(2, '0')

export function toISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fromISO(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayISO() {
  return toISO(new Date())
}

export function addDays(iso, n) {
  const d = fromISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

export function daysBetween(a, b) {
  return Math.round((fromISO(b) - fromISO(a)) / 86400000)
}

// Monday-based week start.
export function weekStart(iso) {
  const d = fromISO(iso)
  const dow = (d.getDay() + 6) % 7
  return addDays(iso, -dow)
}

export function monthStart(iso) {
  return iso.slice(0, 8) + '01'
}

export function monthEnd(iso) {
  const d = fromISO(monthStart(iso))
  return toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}

export function addMonths(iso, n) {
  const d = fromISO(monthStart(iso))
  return toISO(new Date(d.getFullYear(), d.getMonth() + n, 1))
}

export function monthLabel(iso) {
  return fromISO(iso).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

export function dayLabel(iso, today = todayISO()) {
  const diff = daysBetween(iso, today)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  const d = fromISO(iso)
  const opts = { weekday: 'short', day: 'numeric', month: 'short' }
  if (d.getFullYear() !== fromISO(today).getFullYear()) opts.year = 'numeric'
  return d.toLocaleDateString('en-IN', opts)
}
