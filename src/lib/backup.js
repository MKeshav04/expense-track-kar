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

export async function exportJSON() {
  const data = {
    app: 'expense-tracker', // internal ID: keep, so old backups still restore
    version: 1,
    exportedAt: new Date().toISOString(),
    expenses: await db.expenses.toArray(),
    categories: await db.categories.toArray(),
    keywords: await db.keywords.toArray(),
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

// Merges a backup into this phone. Entries with the same id are overwritten, nothing is deleted.
export async function importJSON(file) {
  const data = JSON.parse(await file.text())
  if (data?.app !== 'expense-tracker' || !Array.isArray(data.expenses)) {
    throw new Error("This doesn't look like a backup from this app.")
  }
  const valid = data.expenses.filter(
    (e) => e && typeof e.id === 'string' && Number.isInteger(e.amountPaise) && /^\d{4}-\d{2}-\d{2}$/.test(e.date),
  )
  await db.transaction('rw', db.expenses, db.categories, db.keywords, async () => {
    if (Array.isArray(data.categories)) await db.categories.bulkPut(data.categories.filter((c) => c?.id && c?.name))
    if (Array.isArray(data.keywords)) await db.keywords.bulkPut(data.keywords.filter((k) => k?.word))
    await db.expenses.bulkPut(valid)
  })
  return valid.length
}
