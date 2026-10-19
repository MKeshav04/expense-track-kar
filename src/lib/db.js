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

// v2 adds the monthly plan. Never edit or remove version(1): phones upgrade from it in place.
// expenses.plannedId: set when an expense pays a planned bill / to-buy.
// expenses.fromSavingsPaise: part of an expense paid from a savings goal (not from the budget).
db.version(2).stores({
  expenses: 'id, date, categoryId, createdAt, plannedId',
  planned: 'id, createdAt', // { name, amountPaise, categoryId, repeat: 'monthly'|'once', dueDay?, dueDate? }
  goals: 'id, createdAt', // { name, emoji, targetPaise, doneAt? }
  contributions: 'id, goalId, date', // { goalId, amountPaise, date }
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
    ...(p.plannedId ? { plannedId: p.plannedId } : {}),
    ...(p.fromSavingsPaise ? { fromSavingsPaise: p.fromSavingsPaise } : {}),
  }))
  await db.expenses.bulkAdd(rows)
  for (const r of rows) {
    if (r.categoryId) await learn(r.note, r.categoryId, false)
  }
  return rows
}

// ---- Monthly budget ----

// Sets this month's budget; with everyMonth it also becomes the default for future months.
export async function setBudget(amountPaise, month, everyMonth) {
  const budgets = await getSetting('budgets', {})
  await setSetting('budgets', { ...budgets, [month]: amountPaise })
  if (everyMonth) await setSetting('budgetDefault', amountPaise)
}

export async function clearBudget(month) {
  const budgets = await getSetting('budgets', {})
  delete budgets[month]
  await setSetting('budgets', budgets)
  await setSetting('budgetDefault', null)
}

// Freezes the default into this month the first time the app opens in a month, so changing
// the default later never rewrites past months.
export async function ensureMonthBudget(month) {
  const [budgets, def] = await Promise.all([getSetting('budgets', {}), getSetting('budgetDefault')])
  if (def != null && budgets[month] == null) await setSetting('budgets', { ...budgets, [month]: def })
}

// ---- Coming up: bills and to-buys ----

export async function savePlanned(item) {
  const row = { ...item, id: item.id || uid(), createdAt: item.createdAt || Date.now() }
  await db.planned.put(row)
  return row
}

export async function payPlanned(item, date) {
  const [row] = await addEntries([
    { amountPaise: item.amountPaise, categoryId: item.categoryId, note: item.name, rawText: item.name, date, source: 'manual', plannedId: item.id },
  ])
  return row
}

// ---- Savings goals ----

export async function saveGoal(goal) {
  const row = { ...goal, id: goal.id || uid(), createdAt: goal.createdAt || Date.now() }
  await db.goals.put(row)
  return row
}

// Deleting a goal also deletes its contributions, so that money goes back into those months' budgets.
export async function deleteGoal(id) {
  const goal = await db.goals.get(id)
  const contributions = await db.contributions.where('goalId').equals(id).toArray()
  await db.transaction('rw', db.goals, db.contributions, async () => {
    await db.contributions.bulkDelete(contributions.map((c) => c.id))
    await db.goals.delete(id)
  })
  return async () => {
    await db.goals.put(goal)
    await db.contributions.bulkPut(contributions)
  }
}

export async function addContribution(goalId, amountPaise, date) {
  const row = { id: uid(), goalId, amountPaise, date, createdAt: Date.now() }
  await db.contributions.add(row)
  return row
}

// Logs the purchase as spending; the saved part is marked so this month's budget isn't charged twice.
export async function buyGoal(goal, pricePaise, savedPaise, date) {
  const [row] = await addEntries([
    {
      amountPaise: pricePaise,
      categoryId: goal.categoryId || 'shopping',
      note: goal.name,
      rawText: goal.name,
      date,
      source: 'manual',
      fromSavingsPaise: Math.min(pricePaise, savedPaise),
    },
  ])
  await db.goals.update(goal.id, { doneAt: Date.now(), boughtExpenseId: row.id })
  return row
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
