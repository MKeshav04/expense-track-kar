import { useState } from 'react'
import { todayISO } from '../lib/dates.js'
import { db, updateEntry } from '../lib/db.js'
import { categoryColor } from '../lib/format.js'

export default function EditSheet({ entry, categories, onClose, showToast }) {
  const [amount, setAmount] = useState(String(entry.amountPaise / 100))
  const [categoryId, setCategoryId] = useState(entry.categoryId ?? entry.suggestedCategoryId ?? null)
  const [date, setDate] = useState(entry.date)
  const [note, setNote] = useState(entry.note || '')
  const [error, setError] = useState(null)

  const choices = categories.filter((c) => !c.archived || c.id === entry.categoryId)

  async function save() {
    const value = Number(amount.replace(/,/g, ''))
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter an amount above ₹0.')
      return
    }
    const categoryChanged = categoryId !== entry.categoryId
    await updateEntry(
      entry.id,
      {
        amountPaise: Math.round(value * 100),
        categoryId,
        date,
        note: note.trim(),
        ...(categoryChanged ? { source: 'manual' } : {}),
      },
      { categoryChanged },
    )
    onClose()
  }

  async function remove() {
    const copy = await db.expenses.get(entry.id)
    await db.expenses.delete(entry.id)
    onClose()
    showToast('Entry deleted', () => db.expenses.put(copy))
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="Edit entry" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <label className="field">
          <span>Amount (₹)</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            className="big-input"
          />
        </label>

        <div className="field">
          <span>Category</span>
          <div className="cat-grid">
            {choices.map((c) => (
              <button
                key={c.id}
                className={categoryId === c.id ? 'cat-pick selected' : 'cat-pick'}
                style={{ '--c': categoryColor(c.id) }}
                onClick={() => setCategoryId(c.id)}
              >
                <span aria-hidden>{c.emoji}</span> {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="row">
          <label className="field grow">
            <span>Date</span>
            <input type="date" value={date} max={todayISO()} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </label>
        </div>

        <label className="field">
          <span>Note</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" />
        </label>

        {entry.rawText && <p className="muted small">You typed: “{entry.rawText}”</p>}
        {error && <p className="error">{error}</p>}

        <div className="sheet-actions">
          <button className="btn danger" onClick={remove}>Delete</button>
          <span className="grow" />
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  )
}
