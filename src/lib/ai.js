import { db } from './db.js'

// Talks to our own /api/ai function, which holds the API key. Never called on the save path.

export class AiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function call(body) {
  let res
  try {
    res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45000),
    })
  } catch {
    throw new AiError("Couldn't reach the AI. Check your internet.", 0)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new AiError(data.error || 'The AI request failed.', res.status)
  return data
}

export async function aiSummary(stats) {
  const { text } = await call({ mode: 'summary', stats })
  return text
}

let disabled = false
let running = false

// Ask the AI for a category on recent uncategorised entries. Safe to call often.
export async function suggestMissing(categories) {
  if (disabled || running || !navigator.onLine) return
  running = true
  try {
    const active = categories.filter((c) => !c.archived)
    const pending = (await db.expenses.orderBy('createdAt').reverse().limit(200).toArray())
      .filter((e) => !e.categoryId && !e.aiTried && (e.note || e.rawText))
      .slice(0, 5)
    for (const e of pending) {
      try {
        const { category } = await call({
          mode: 'categorize',
          text: e.note || e.rawText,
          categories: active.map((c) => c.name),
        })
        const match = active.find((c) => c.name.toLowerCase() === String(category).toLowerCase())
        await db.expenses.update(e.id, { aiTried: true, suggestedCategoryId: match?.id ?? null })
      } catch (err) {
        if (err.status === 0) return // offline: try again later
        if (err.status === 503 || err.status === 403) {
          disabled = true // AI not set up; stop for this session
          return
        }
        await db.expenses.update(e.id, { aiTried: true })
      }
    }
  } finally {
    running = false
  }
}
