import Dexie from 'dexie'
import { KEYWORD_MIN_COUNT, learnableWords } from './parse.js'
import { DEFAULT_CATEGORIES, SEED_KEYWORDS } from './seed.js'

// Everything lives in IndexedDB on this phone. Nothing here touches the network.
// Internal name: never rename, or every phone loses its saved entries.
export const db = new Dexie('expense-tracker')

db.version(1).stores({
  // amountPaise: integer, date: 'YYYY-MM-DD' local day, categoryId: null = uncategorised
  expenses: 'id, date, categoryId, createdAt',
  categories: 'id, order',
  keywords: 'word',
  settings: 'key',
})

db.on('populate', (tx) => {
  tx.table('categories').bulkAdd(DEFAULT_CATEGORIES.map((c) => ({ ...c, archived: false })))
  const now = Date.now()
  const rows = []
  for (const [categoryId, words] of Object.entries(SEED_KEYWORDS)) {
    for (const word of words) rows.push({ word, categoryId, count: 5, lastUsed: now })
  }
  tx.table('keywords').bulkAdd(rows)
})

export const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

export async function getSetting(key, fallback = null) {
  const row = await db.settings.get(key)
  return row ? row.value : fallback
}

export function setSetting(key, value) {
  return db.settings.put({ key, value })
}

// Days you marked "spent nothing", so the logging streak survives them.
export async function toggleNoSpend(date) {
  const days = await getSetting('noSpendDays', [])
  const next = days.includes(date) ? days.filter((d) => d !== date) : [...days, date]
  await setSetting('noSpendDays', next)
  return next.includes(date)
}

export async function addEntries(parsed) {
  const now = Date.now()
  const rows = parsed.map((p, i) => ({
    id: uid(),
    amountPaise: p.amountPaise,
    categoryId: p.categoryId,
    note: p.note,
    rawText: p.rawText,
    date: p.date,
    source: p.source === 'none' ? 'none' : p.source,
    createdAt: now + i,
    updatedAt: now + i,
  }))
  await db.expenses.bulkAdd(rows)
  for (const r of rows) {
    if (r.categoryId) await learn(r.note, r.categoryId, false)
  }
  return rows
}

export async function updateEntry(id, changes, { categoryChanged } = {}) {
  await db.expenses.update(id, { ...changes, updatedAt: Date.now() })
  if (categoryChanged && changes.categoryId) {
    const e = await db.expenses.get(id)
    await learn(e.note, changes.categoryId, true)
  }
}

// Keyword memory. A correction ("strong") is trusted straight away; an ordinary save
// only nudges the count, so one-off words like "team" never take over a category.
export async function learn(note, categoryId, strong) {
  const words = learnableWords(note)
  if (!words.length) return
  const now = Date.now()
  await db.transaction('rw', db.keywords, async () => {
    for (const word of words) {
      const k = await db.keywords.get(word)
      let next
      if (strong) {
        const base = k && k.categoryId === categoryId ? k.count + 1 : 0
        next = { word, categoryId, count: Math.max(KEYWORD_MIN_COUNT, base) }
      } else if (!k) {
        next = { word, categoryId, count: 1 }
      } else if (k.categoryId === categoryId) {
        next = { ...k, count: k.count + 1 }
      } else if (k.count <= 1) {
        next = { word, categoryId, count: 1 }
      } else {
        next = { ...k, count: k.count - 1 }
      }
      await db.keywords.put({ ...next, lastUsed: now })
    }
  })
}

export async function requestPersistence() {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
