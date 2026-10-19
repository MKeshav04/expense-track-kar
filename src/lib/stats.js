import {
  addDays, addMonths, dayLabel, daysBetween, fromISO, monthEnd, monthLabel, monthStart, todayISO, weekStart,
} from './dates.js'
import { categoryOf, percent, rupees } from './format.js'
import { learnableWords } from './parse.js'

// All arithmetic for summaries happens here. The AI only ever sees the results.

export function periodRange(period, anchor) {
  if (period === 'day') return { start: anchor, end: anchor }
  if (period === 'week') {
    const start = weekStart(anchor)
    return { start, end: addDays(start, 6) }
  }
  return { start: monthStart(anchor), end: monthEnd(anchor) }
}

export function shiftAnchor(period, anchor, dir) {
  if (period === 'day') return addDays(anchor, dir)
  if (period === 'week') return addDays(anchor, dir * 7)
  return addMonths(anchor, dir)
}

// The same span in the previous period, cut at the same point ("by this date last month").
function previousRange(period, start, end, today) {
  const elapsedEnd = today >= start && today <= end ? today : end
  const elapsed = daysBetween(start, elapsedEnd)
  let prevStart
  if (period === 'day') prevStart = addDays(start, -1)
  else if (period === 'week') prevStart = addDays(start, -7)
  else prevStart = addMonths(start, -1)
  const prevPeriodEnd = period === 'month' ? monthEnd(prevStart) : addDays(start, -1)
  const cut = addDays(prevStart, elapsed)
  return { start: prevStart, end: cut < prevPeriodEnd ? cut : prevPeriodEnd, inProgress: elapsedEnd !== end }
}

const sum = (rows) => rows.reduce((s, e) => s + e.amountPaise, 0)

function byCategory(rows) {
  const map = new Map()
  for (const e of rows) {
    const k = e.categoryId ?? null
    const cur = map.get(k) || { categoryId: k, total: 0, count: 0 }
    cur.total += e.amountPaise
    cur.count += 1
    map.set(k, cur)
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
}

export function computeSummary(expenses, period, anchor, today = todayISO()) {
  const { start, end } = periodRange(period, anchor)
  const prev = previousRange(period, start, end, today)
  const inRange = (e, s, t) => e.date >= s && e.date <= t
  const rows = expenses.filter((e) => inRange(e, start, end))
  const prevRows = expenses.filter((e) => inRange(e, prev.start, prev.end))

  const total = sum(rows)
  const prevTotal = sum(prevRows)
  const prevByCat = new Map(byCategory(prevRows).map((c) => [c.categoryId, c.total]))

  const daily = []
  if (period !== 'day') {
    const totals = new Map()
    for (const e of rows) totals.set(e.date, (totals.get(e.date) || 0) + e.amountPaise)
    for (let d = start; d <= end; d = addDays(d, 1)) daily.push({ date: d, total: totals.get(d) || 0 })
  }

  const lastDay = today >= start && today <= end ? today : end
  const daysElapsed = today < start ? 0 : daysBetween(start, lastDay) + 1

  return {
    period,
    start,
    end,
    total,
    prevTotal,
    prevStart: prev.start,
    prevEnd: prev.end,
    inProgress: prev.inProgress,
    daysElapsed,
    count: rows.length,
    categories: byCategory(rows).map((c) => ({ ...c, prevTotal: prevByCat.get(c.categoryId) || 0 })),
    daily,
    top: [...rows].sort((a, b) => b.amountPaise - a.amountPaise).slice(0, 5),
    rows,
  }
}

export function periodLabel(period, anchor, today = todayISO()) {
  const { start, end } = periodRange(period, anchor)
  if (period === 'month') return monthLabel(start)
  const fmt = (iso, o) => fromISO(iso).toLocaleDateString('en-IN', o)
  if (period === 'day') {
    if (anchor === today) return 'Today'
    if (anchor === addDays(today, -1)) return 'Yesterday'
    return fmt(anchor, { weekday: 'short', day: 'numeric', month: 'short' })
  }
  if (start === weekStart(today)) return 'This week'
  return `${fmt(start, { day: 'numeric', month: 'short' })} – ${fmt(end, { day: 'numeric', month: 'short' })}`
}

export function compareLabel(period) {
  return { day: 'the day before', week: 'this point last week', month: 'this point last month' }[period]
}

// Pre-formatted facts for the AI. Every number in here was computed above.
// mb: optional { budget, saved, left } for the month, all in paise.
export function statsForAI(s, categories, label, mb = null) {
  const change = s.prevTotal ? Math.round(((s.total - s.prevTotal) / s.prevTotal) * 100) : null
  const hasPrev = s.prevTotal > 0
  return {
    period: label + (s.inProgress ? ` (in progress, ${s.daysElapsed} days so far)` : ''),
    total: rupees(s.total),
    entries: s.count,
    dailyAverage: s.daysElapsed ? rupees(Math.round(s.total / s.daysElapsed / 100) * 100) : null,
    comparedTo: hasPrev
      ? `${compareLabel(s.period)}: ${rupees(s.prevTotal)} (${change >= 0 ? '+' : ''}${change}%)`
      : undefined, // no history yet: leave the comparison out entirely
    categories: s.categories.map((c) => {
      const cat = categoryOf(categories, c.categoryId)
      return {
        name: cat.name,
        amount: rupees(c.total),
        shareOfTotal: `${percent(c.total, s.total)}%`,
        entries: c.count,
        ...(hasPrev ? { sameSpanLastPeriod: rupees(c.prevTotal) } : {}),
      }
    }),
    ...(mb
      ? {
          monthlyBudget: rupees(mb.budget),
          savedToGoalsThisMonth: rupees(mb.saved),
          [mb.left < 0 ? 'overBudgetBy' : 'leftOfBudget']: rupees(Math.abs(mb.left)),
        }
      : {}),
    biggestEntries: s.top.map((e) => ({
      amount: rupees(e.amountPaise),
      category: categoryOf(categories, e.categoryId).name,
      note: e.note || null,
      date: e.date,
    })),
  }
}

// Consecutive days (ending today, or yesterday if today is still empty) with an entry
// or a "no-spend" mark.
export function streak(dates, today = todayISO()) {
  let d = dates.has(today) ? today : addDays(today, -1)
  let n = 0
  while (dates.has(d)) {
    n += 1
    d = addDays(d, -1)
  }
  return n
}

// Usual daily spend over the last 30 days, not counting today. Null until there's enough history.
export function usualDaily(expenses, today = todayISO()) {
  const from = addDays(today, -30)
  const past = expenses.filter((e) => e.date >= from && e.date < today)
  if (!past.length) return null
  const first = past.reduce((m, e) => (e.date < m ? e.date : m), today)
  const days = daysBetween(first, today)
  if (days < 3) return null
  return Math.round(sum(past) / days)
}

export function funFacts(s, today = todayISO()) {
  const facts = []
  const words = new Map()
  for (const e of s.rows) {
    for (const w of learnableWords(e.note)) words.set(w, (words.get(w) || 0) + 1)
  }
  const fav = [...words].sort((a, b) => b[1] - a[1])[0]
  if (fav && fav[1] >= 2) facts.push({ icon: '🔁', big: `${fav[0]} ×${fav[1]}`, small: 'most repeated' })

  const past = s.daily.filter((d) => d.date <= today)
  const peak = past.reduce((m, d) => (d.total > (m?.total || 0) ? d : m), null)
  if (peak && s.period !== 'day') facts.push({ icon: '📈', big: rupees(peak.total), small: `biggest day · ${dayLabel(peak.date, today)}` })

  // Days before your first entry here aren't "no-spend", you just weren't tracking yet.
  const firstLogged = s.rows.reduce((m, e) => (e.date < m ? e.date : m), today)
  const zero = past.filter((d) => d.total === 0 && d.date >= firstLogged).length
  if (s.period !== 'day' && past.length > 1) {
    facts.push({ icon: zero ? '🧘' : '🔥', big: `${zero}`, small: zero === 1 ? 'no-spend day' : 'no-spend days' })
  }
  if (s.count) facts.push({ icon: '🧾', big: rupees(Math.round(s.total / s.count / 100) * 100), small: 'average entry' })
  return facts.slice(0, 4)
}

export function summaryText(s, categories, label) {
  const lines = [`${label}: ${rupees(s.total)} spent (${s.count} entries)`]
  for (const c of s.categories) {
    const cat = categoryOf(categories, c.categoryId)
    lines.push(`${cat.emoji} ${cat.name}: ${rupees(c.total)} (${percent(c.total, s.total)}%)`)
  }
  return lines.join('\n')
}
