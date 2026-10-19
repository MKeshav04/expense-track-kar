import { todayISO } from './dates.js'
import { db, setSetting } from './db.js'
import { categoryOf } from './format.js'

async function shareOrDownload(blob, filename) {
  const file = new File([blob], filename, { type: blob.type })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename })
      return true
    } catch (err) {
      if (err?.name === 'AbortError') return false
      // Fall through to a plain download.
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
  return true
}

// Settings worth carrying to a new phone (budget and no-spend days; not "last backup").
const BACKED_UP_SETTINGS = ['budgets', 'budgetDefault', 'noSpendDays']

export async function exportJSON() {
  const data = {
    app: 'expense-tracker', // internal ID: keep, so old backups still restore
    version: 2,
    exportedAt: new Date().toISOString(),
    expenses: await db.expenses.toArray(),
    categories: await db.categories.toArray(),
    keywords: await db.keywords.toArray(),
    planned: await db.planned.toArray(),
    goals: await db.goals.toArray(),
    contributions: await db.contributions.toArray(),
    settings: (await db.settings.toArray()).filter((r) => BACKED_UP_SETTINGS.includes(r.key)),
  }
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const done = await shareOrDownload(blob, `expenses-backup-${todayISO()}.json`)
  if (done) await setSetting('lastBackupAt', Date.now())
  return done
}

export async function exportCSV() {
  const [expenses, categories] = await Promise.all([db.expenses.orderBy('date').toArray(), db.categories.toArray()])
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = ['Date,Amount,Category,Note,You typed']
  for (const e of expenses) {
    lines.push([e.date, (e.amountPaise / 100).toFixed(2), esc(categoryOf(categories, e.categoryId).name), esc(e.note), esc(e.rawText)].join(','))
  }
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv' })
  return shareOrDownload(blob, `expenses-${todayISO()}.csv`)
}

// Merges a backup into this phone. Rows with the same id are overwritten, nothing is deleted.
// Version 1 backups (before budgets and plans) still restore.
export async function importJSON(file) {
  const data = JSON.parse(await file.text())
  if (data?.app !== 'expense-tracker' || !Array.isArray(data.expenses)) {
    throw new Error("This doesn't look like a backup from this app.")
  }
  const valid = data.expenses.filter(
    (e) => e && typeof e.id === 'string' && Number.isInteger(e.amountPaise) && /^\d{4}-\d{2}-\d{2}$/.test(e.date),
  )
  const withId = (rows) => (Array.isArray(rows) ? rows.filter((r) => r && typeof r.id === 'string') : [])
  const tables = [db.expenses, db.categories, db.keywords, db.planned, db.goals, db.contributions, db.settings]
  await db.transaction('rw', tables, async () => {
    if (Array.isArray(data.categories)) await db.categories.bulkPut(data.categories.filter((c) => c?.id && c?.name))
    if (Array.isArray(data.keywords)) await db.keywords.bulkPut(data.keywords.filter((k) => k?.word))
    await db.expenses.bulkPut(valid)
    await db.planned.bulkPut(withId(data.planned))
    await db.goals.bulkPut(withId(data.goals))
    await db.contributions.bulkPut(withId(data.contributions))
    // Merge settings rather than overwrite, so nothing already on this phone is lost.
    for (const r of Array.isArray(data.settings) ? data.settings : []) {
      if (!BACKED_UP_SETTINGS.includes(r?.key)) continue
      const current = (await db.settings.get(r.key))?.value
      let value = r.value
      if (r.key === 'budgets') value = { ...(r.value || {}), ...(current || {}) }
      if (r.key === 'noSpendDays') value = [...new Set([...(current || []), ...(r.value || [])])]
      if (r.key === 'budgetDefault' && current != null) value = current
      await db.settings.put({ key: r.key, value })
    }
  })
  return valid.length
}
