import { useState } from 'react'
import { parseRupees } from '../lib/budget.js'
import { fromISO } from '../lib/dates.js'
import { clearBudget, setBudget } from '../lib/db.js'
import { rupees } from '../lib/format.js'
import Sheet, { AmountField } from './Sheet.jsx'

const monthName = (iso) => fromISO(iso).toLocaleDateString('en-IN', { month: 'long' })

// The yellow card at the top of the home screen once a budget is set. Kept deliberately simple:
// what's left, and what's spent. The full breakdown lives on the Plan tab (BudgetBreakdown).
export default function BudgetCard({ budget: b, today, bump, onEdit }) {
  const [info, setInfo] = useState(false)

  return (
    <section className={b.over ? 'hero budget over' : 'hero budget'}>
      <div className="hero-top">
        <span className="hero-label">{monthName(today)} budget</span>
        <span className="budget-actions">
          <button className="info-btn" onClick={() => setInfo((v) => !v)} aria-expanded={info} aria-label="What is this?">
            ?
          </button>
          <button className="nospend" onClick={onEdit}>Edit</button>
        </span>
      </div>

      <div className="budget-main">
        <div className="budget-left-wrap">
          <div key={bump} className="hero-amount budget-left">{rupees(Math.abs(b.left))}</div>
          <div className="budget-left-label">{b.over ? 'over budget this month 😬' : 'left to spend this month'}</div>
        </div>
        <div className="budget-side">
          <span>Spent</span>
          <strong>{rupees(b.spent)}</strong>
          <span>of {rupees(b.budget)}</span>
        </div>
      </div>

      {info && (
        <p className="budget-info">
          Your budget is what you plan to spend this month. Every expense you log is taken off it, and so is
          money you put into a savings goal. It starts fresh on the 1st. The full breakdown, with bills kept
          aside and what's free per day, is on the 📌 Plan tab.
        </p>
      )}
    </section>
  )
}

// Full budget picture for the Plan tab: one bar and four plain rows.
export function BudgetBreakdown({ budget: b, today, onEdit }) {
  const pct = (x) => (b.budget > 0 ? Math.max(0, Math.min(100, (x / b.budget) * 100)) : 0)
  const parts = b.over
    ? [{ key: 'spent', w: 100 }]
    : [
        { key: 'spent', w: pct(b.spent) },
        { key: 'saved', w: pct(b.saved) },
        { key: 'kept', w: pct(Math.min(b.reserved, Math.max(0, b.left))) },
      ]
  const bills = `Kept for ${b.billsCount} ${b.billsCount === 1 ? 'bill' : 'bills'}`

  return (
    <section className="card breakdown-card">
      <div className="card-head">
        <h2>💰 {monthName(today)} budget · {rupees(b.budget)}</h2>
        <button className="btn small" onClick={onEdit}>Edit</button>
      </div>
      <div className="budget-bar on-card" aria-hidden>
        {parts.map((p) => (
          <span key={p.key} className={`seg-${p.key}`} style={{ width: `${p.w}%` }} />
        ))}
      </div>
      <ul className="breakdown">
        <li><i className="dot dot-spent" /> Spent <b>{rupees(b.spent)}</b></li>
        {b.saved > 0 && <li><i className="dot dot-saved" /> Saved to goals <b>{rupees(b.saved)}</b></li>}
        {b.reserved > 0 && <li><i className="dot dot-kept" /> {bills} <b>{rupees(b.reserved)}</b></li>}
        <li className="breakdown-total">
          <i className="dot dot-free" /> {b.free < 0 ? 'Short for your bills' : 'Free to spend'}
          <b className={b.free < 0 ? 'up' : ''}>{rupees(Math.abs(b.free))}</b>
        </li>
      </ul>
      {b.free > 0 && (
        <p className="muted small breakdown-day">
          ≈ {rupees(b.perDay)}/day for the next {b.daysLeft} {b.daysLeft === 1 ? 'day' : 'days'}
        </p>
      )}
    </section>
  )
}

export function BudgetCta({ onClick }) {
  return (
    <button className="budget-cta" onClick={onClick}>
      <span className="cta-emoji" aria-hidden>💰</span>
      <span className="cta-text">
        <strong>Set a monthly budget</strong>
        <span>See what's left to spend this month, updated with every entry.</span>
      </span>
      <span className="cta-arrow" aria-hidden>›</span>
    </button>
  )
}

export function BudgetSheet({ current, month, today, onClose, showToast }) {
  const [amount, setAmount] = useState(current ? String(current / 100) : '')
  const [everyMonth, setEveryMonth] = useState(true)
  const [error, setError] = useState(null)

  async function save() {
    const paise = parseRupees(amount)
    if (!paise) return setError('Enter an amount, like 5000.')
    await setBudget(paise, month, everyMonth)
    onClose()
    showToast(`Budget set: ${rupees(paise)} for ${monthName(today)}`)
  }

  async function remove() {
    await clearBudget(month)
    onClose()
    showToast('Budget removed')
  }

  return (
    <Sheet title="Monthly budget" onClose={onClose}>
      <p className="muted small sheet-intro">
        How much you plan to spend in a month. Every expense you log comes off it, so you always see what's left.
      </p>
      <AmountField
        value={amount}
        onChange={(v) => { setAmount(v); setError(null) }}
        autoFocus
        quick={[3000, 5000, 10000, 15000].map((n) => ({ label: rupees(n * 100), value: String(n) }))}
      />
      <label className="check">
        <input type="checkbox" checked={everyMonth} onChange={(e) => setEveryMonth(e.target.checked)} />
        <span>Use this every month</span>
      </label>
      {error && <p className="error">{error}</p>}
      <div className="sheet-actions">
        {current && <button className="btn danger" onClick={remove}>Remove</button>}
        <span className="grow" />
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save}>Save</button>
      </div>
    </Sheet>
  )
}
