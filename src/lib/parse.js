import { addDays, fromISO, toISO } from './dates.js'

// Pure parsing: no database, no network. Everything it needs is passed in.
//
// parseInput('150 food, 1k shopping', { categories, keywords, today })
//   -> { entries: [{ amountPaise, categoryId, date, note, rawText, source }], error }
//
// categories: [{ id, name, aliases: [] }]
// keywords:   Map(word -> { categoryId, count }); a word is trusted at count >= 3
// today:      'YYYY-MM-DD'

const CURRENCY = new Set(['₹', 'rs', 'rs.', 'inr', 'rupees', 'rupee', '/-'])
const FILLERS = new Set([
  'on', 'for', 'spent', 'spend', 'paid', 'pay', 'of', 'the', 'at', 'to', 'in',
  'a', 'an', 'i', 'my', 'bought', 'buy', 'got', 'from',
])
const WEEKDAYS = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2,
  wed: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5, sat: 6, saturday: 6,
}
const AMOUNT_RE = /^(?:₹|rs\.?|inr)?(\d+(?:\.\d+)?)(k|rs\.?|₹|\/-)?$/
const DATE_RE = /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2}|\d{4}))?$/

export const KEYWORD_MIN_COUNT = 3

export function normalise(text) {
  let s = text.toLowerCase().replace(/\s+/g, ' ').trim()
  // Drop thousands separators: 1,000 and Indian-style 1,00,000.
  let prev
  do {
    prev = s
    s = s.replace(/(\d),(?=\d{2},\d|\d{3}(?!\d))/g, '$1')
  } while (s !== prev)
  return s
}

// "150 food, 40 auto" -> two parts. Only split when every part has its own amount,
// so "bread and butter 60" stays one entry.
export function splitEntries(text) {
  const parts = text
    .split(/\s*(?:,|;|\n|\band\b|&|\+)\s*/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length > 1 && parts.every(hasAmount)) return parts
  return [text.trim()]
}

function hasAmount(part) {
  return tokenize(part).some((t) => AMOUNT_RE.test(t) && !DATE_RE.test(t))
}

function tokenize(s) {
  return s
    .replace(/₹/g, ' ₹')
    .replace(/(\d)(rs\.?|\/-)(?=\s|$)/g, '$1 $2')
    .split(' ')
    .filter(Boolean)
}

function resolveDate(tokens, today, used) {
  let date = today
  const s = tokens.join(' ')

  const ago = s.match(/\b(\d{1,2}) ?days? ago\b/)
  if (ago) {
    // Mark the three tokens as used.
    const i = tokens.findIndex((t, j) => t === ago[1] && /^days?$/.test(tokens[j + 1] || ''))
    if (i >= 0) [i, i + 1, i + 2].forEach((j) => used.add(j))
    return addDays(today, -Number(ago[1]))
  }

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t === 'today' || t === 'tod') {
      used.add(i)
    } else if (['yesterday', 'yday', 'yest', 'ytd'].includes(t)) {
      if (tokens[i - 1] === 'before' && tokens[i - 2] === 'day') {
        used.add(i).add(i - 1).add(i - 2)
        date = addDays(today, -2)
      } else {
        used.add(i)
        date = addDays(today, -1)
      }
    } else if (t in WEEKDAYS) {
      used.add(i)
      if (tokens[i - 1] === 'last') used.add(i - 1)
      // Most recent past occurrence; the same weekday means last week.
      const dow = fromISO(today).getDay()
      const back = (dow - WEEKDAYS[t] + 7) % 7 || 7
      date = addDays(today, -back)
    } else if (DATE_RE.test(t)) {
      const [, dd, mm, yy] = t.match(DATE_RE)
      const day = Number(dd)
      const month = Number(mm)
      if (day < 1 || day > 31 || month < 1 || month > 12) continue
      const thisYear = fromISO(today).getFullYear()
      let year = yy ? Number(yy.length === 2 ? '20' + yy : yy) : thisYear
      let candidate = toISO(new Date(year, month - 1, day))
      if (!yy && candidate > today) candidate = toISO(new Date(year - 1, month - 1, day))
      used.add(i)
      date = candidate
    }
  }
  return date
}

function resolveAmount(tokens, used) {
  const found = []
  for (let i = 0; i < tokens.length; i++) {
    if (used.has(i)) continue
    const m = tokens[i].match(AMOUNT_RE)
    if (!m) continue
    let value = Number(m[1])
    if (m[2] === 'k') value *= 1000
    const marked =
      /^(₹|rs|inr)/.test(tokens[i]) ||
      (m[2] && m[2] !== 'k') ||
      CURRENCY.has(tokens[i - 1]) ||
      CURRENCY.has(tokens[i + 1])
    found.push({ i, value, marked, k: m[2] === 'k' })
  }
  if (!found.length) return null
  // Prefer a number written with ₹/rs, then the largest ("2 coffees 300" -> 300).
  const pool = found.some((f) => f.marked) ? found.filter((f) => f.marked) : found
  const best = pool.reduce((a, b) => (b.value > a.value ? b : a))
  used.add(best.i)
  return Math.round(best.value * 100)
}

export function levenshtein(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 2
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
      // Swapped neighbours ("fodo") count as one typo.
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1)
      }
    }
  }
  return dp[a.length][b.length]
}

function resolveCategory(tokens, used, categories, keywords) {
  const free = tokens.map((t, i) => (used.has(i) ? null : t))
  const names = []
  for (const c of categories) {
    for (const n of [c.name, ...(c.aliases || [])]) names.push({ n: n.toLowerCase(), id: c.id })
  }

  // 1. Category name or alias, including two-word aliases like "eating out".
  for (let i = 0; i < free.length; i++) {
    if (!free[i]) continue
    const bigram = free[i + 1] ? `${free[i]} ${free[i + 1]}` : null
    const hit2 = bigram && names.find((x) => x.n === bigram)
    if (hit2) return { categoryId: hit2.id, source: 'rule', drop: [i, i + 1], isName: true }
    const hit = names.find((x) => x.n === free[i])
    if (hit) {
      const isName = categories.some((c) => c.id === hit.id && c.name.toLowerCase() === free[i])
      return { categoryId: hit.id, source: 'rule', drop: isName ? [i] : [], isName }
    }
  }

  // 2. Keyword memory: highest count wins.
  let best = null
  for (const t of free) {
    const k = t && keywords.get(t)
    if (k && k.count >= KEYWORD_MIN_COUNT && categories.some((c) => c.id === k.categoryId)) {
      if (!best || k.count > best.count) best = k
    }
  }
  if (best) return { categoryId: best.categoryId, source: 'memory', drop: [] }

  // 3. One-letter typo, only on words of 4+ letters ("fodo" -> Food, but "car" != "Care").
  for (let i = 0; i < free.length; i++) {
    const t = free[i]
    if (!t || t.length < 4 || !/^[a-z]+$/.test(t)) continue
    const hit = names.find((x) => x.n.length >= 4 && levenshtein(t, x.n) === 1)
    if (hit) return { categoryId: hit.id, source: 'rule', drop: [i] }
  }

  return { categoryId: null, source: 'none', drop: [] }
}

export function parseOne(part, { categories, keywords, today }) {
  const tokens = tokenize(normalise(part))
  const used = new Set()
  const date = resolveDate(tokens, today, used)
  const amountPaise = resolveAmount(tokens, used)
  if (amountPaise === null) return { error: 'Add an amount, like "150 food".' }
  if (amountPaise <= 0) return { error: 'Amount must be more than ₹0.' }

  tokens.forEach((t, i) => CURRENCY.has(t) && used.add(i))
  const cat = resolveCategory(tokens, used, categories, keywords)
  cat.drop.forEach((i) => used.add(i))

  const rest = tokens.filter((_, i) => !used.has(i))
  while (rest.length && FILLERS.has(rest[0])) rest.shift()
  while (rest.length && FILLERS.has(rest[rest.length - 1])) rest.pop()

  return {
    amountPaise,
    categoryId: cat.categoryId,
    source: cat.source,
    date,
    note: rest.join(' '),
    rawText: part.trim(),
  }
}

export function parseInput(text, ctx) {
  if (!text || !text.trim()) return { entries: [], error: null }
  const parts = splitEntries(normalise(text))
  const entries = []
  for (const part of parts) {
    const r = parseOne(part, ctx)
    if (r.error) return { entries: [], error: parts.length > 1 ? `"${part}": ${r.error}` : r.error }
    entries.push(r)
  }
  return { entries, error: null }
}

// Words worth learning from a note: no numbers, no filler, 3+ letters.
export function learnableWords(note) {
  return [...new Set(normalise(note || '').split(' '))].filter(
    (w) => w.length >= 3 && /^[a-z][a-z0-9]*$/.test(w) && !FILLERS.has(w) && !(w in WEEKDAYS) &&
      !['with', 'and', 'today', 'yesterday', 'friends', 'team', 'bro', 'home', 'office'].includes(w),
  )
}
