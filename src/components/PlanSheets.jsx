import { useState } from 'react'
import { parseRupees } from '../lib/budget.js'
import { dayLabel } from '../lib/dates.js'
import { addContribution, buyGoal, db, deleteGoal, saveGoal, savePlanned } from '../lib/db.js'
import { categoryColor, rupees } from '../lib/format.js'
import Sheet, { AmountField } from './Sheet.jsx'

const toInput = (paise) => (paise ? String(paise / 100) : '')

// Add or edit a bill / to-buy.
export function PlannedSheet({ item, categories, onClose, showToast }) {
  const editing = !!item?.id
  const [name, setName] = useState(item?.name || '')
  const [amount, setAmount] = useState(toInput(item?.amountPaise))
  const [repeat, setRepeat] = useState(item?.repeat || 'monthly')
  const [dueDay, setDueDay] = useState(item?.dueDay ? String(item.dueDay) : '')
  const [dueDate, setDueDate] = useState(item?.dueDate || '')
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? null)
  const [error, setError] = useState(null)
  const choices = categories.filter((c) => !c.archived || c.id === categoryId)
  const fallbackCategory = repeat === 'monthly' ? 'bills' : 'shopping'

  async function save() {
    const paise = parseRupees(amount)
    if (!name.trim()) return setError('Give it a name, like “Netflix” or “Shoes”.')
    if (!paise) return setError('Enter the amount, like 199.')
    const day = Number(dueDay)
    await savePlanned({
      ...(item || {}),
      name: name.trim(),
      amountPaise: paise,
      repeat,
      categoryId: categoryId ?? fallbackCategory,
      dueDay: repeat === 'monthly' && day >= 1 && day <= 31 ? day : null,
      dueDate: repeat === 'once' && dueDate ? dueDate : null,
    })
    onClose()
    showToast(editing ? 'Saved' : `📌 ${name.trim()} added · ${rupees(paise)} kept aside`)
  }

  async function remove() {
    const copy = await db.planned.get(item.id)
    await db.planned.delete(item.id)
    onClose()
    showToast(`${item.name} removed`, () => db.planned.put(copy))
  }

  return (
    <Sheet title={editing ? 'Edit' : 'Add a bill or to-buy'} onClose={onClose}>
      <div className="segmented sheet-seg">
        <button className={repeat === 'monthly' ? 'seg active' : 'seg'} onClick={() => setRepeat('monthly')}>
          🔁 Every month
        </button>
        <button className={repeat === 'once' ? 'seg active' : 'seg'} onClick={() => setRepeat('once')}>
          🛍️ One-time
        </button>
      </div>
      <p className="muted small sheet-intro">
        {repeat === 'monthly'
          ? 'Rent, Netflix, recharge, gym… Kept aside every month until you mark it paid.'
          : 'Something you must buy: a gift, shoes, a course… Kept aside until you buy it.'}
      </p>
      <label className="field">
        <span>Name</span>
        <input value={name} onChange={(e) => { setName(e.target.value); setError(null) }} placeholder={repeat === 'monthly' ? 'Netflix' : 'Running shoes'} autoFocus={!editing} />
      </label>
      <AmountField value={amount} onChange={(v) => { setAmount(v); setError(null) }} />
      {repeat === 'monthly' ? (
        <label className="field">
          <span>Due on day (optional)</span>
          <input value={dueDay} onChange={(e) => setDueDay(e.target.value.replace(/\D/g, '').slice(0, 2))} inputMode="numeric" placeholder="e.g. 5" />
        </label>
      ) : (
        <label className="field">
          <span>Buy by (optional)</span>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
      )}
      <div className="field">
        <span>Category</span>
        <div className="cat-grid">
          {choices.map((c) => (
            <button
              key={c.id}
              className={(categoryId ?? fallbackCategory) === c.id ? 'cat-pick selected' : 'cat-pick'}
              style={{ '--c': categoryColor(c.id) }}
              onClick={() => setCategoryId(c.id)}
            >
              <span aria-hidden>{c.emoji}</span> {c.name}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="sheet-actions">
        {editing && <button className="btn danger" onClick={remove}>Delete</button>}
        <span className="grow" />
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save}>Save</button>
      </div>
    </Sheet>
  )
}

// Create or edit a savings goal; when editing, also lists what's been put in.
export function GoalSheet({ goal, contributions, onClose, showToast }) {
  const editing = !!goal?.id
  const [name, setName] = useState(goal?.name || '')
  const [emoji, setEmoji] = useState(goal?.emoji || '🎯')
  const [target, setTarget] = useState(toInput(goal?.targetPaise))
  const [error, setError] = useState(null)
  const mine = editing
    ? contributions.filter((c) => c.goalId === goal.id).sort((a, b) => (a.date < b.date ? 1 : -1))
    : []

  async function save() {
    const paise = parseRupees(target)
    if (!name.trim()) return setError('What are you saving for?')
    if (!paise) return setError('Enter the target, like 2000.')
    await saveGoal({ ...(goal || {}), name: name.trim(), emoji: emoji.trim() || '🎯', targetPaise: paise })
    onClose()
    showToast(editing ? 'Saved' : `🐷 Goal added: ${name.trim()}`)
  }

  async function remove() {
    const undo = await deleteGoal(goal.id)
    onClose()
    showToast(`${goal.name} deleted · its money is back in your budget`, undo)
  }

  async function removeContribution(c) {
    await db.contributions.delete(c.id)
    showToast(`${rupees(c.amountPaise)} taken out of ${goal.name}`, () => db.contributions.put(c))
  }

  return (
    <Sheet title={editing ? goal.name : 'New savings goal'} onClose={onClose}>
      {!editing && (
        <p className="muted small sheet-intro">
          Put money in whenever you can, any amount. It comes out of that month's budget, so it's really set aside.
        </p>
      )}
      <div className="row">
        <label className="field emoji-field">
          <span>Icon</span>
          <input className="emoji-input" value={emoji} onChange={(e) => setEmoji(e.target.value)} />
        </label>
        <label className="field grow">
          <span>Saving for</span>
          <input value={name} onChange={(e) => { setName(e.target.value); setError(null) }} placeholder="Headphones" autoFocus={!editing} />
        </label>
      </div>
      <AmountField label="Target (₹)" value={target} onChange={(v) => { setTarget(v); setError(null) }} />
      {mine.length > 0 && (
        <div className="field">
          <span>Put in so far</span>
          <ul className="contrib-list">
            {mine.map((c) => (
              <li key={c.id}>
                <span>{dayLabel(c.date)}</span>
                <strong>{rupees(c.amountPaise)}</strong>
                <button className="icon-btn small-x" onClick={() => removeContribution(c)} aria-label="Take this out">×</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <div className="sheet-actions">
        {editing && !goal.doneAt && <button className="btn danger" onClick={remove}>Delete</button>}
        <span className="grow" />
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save}>Save</button>
      </div>
    </Sheet>
  )
}

// Put money into a goal. It comes out of this month's budget.
export function MoneySheet({ goal, budget, today, onClose, showToast }) {
  const [amount, setAmount] = useState('')
  const [error, setError] = useState(null)
  const paise = parseRupees(amount) || 0
  const remaining = goal.stats.remaining

  async function save() {
    if (!paise) return setError('Enter an amount, like 500.')
    const row = await addContribution(goal.id, paise, today)
    navigator.vibrate?.(12)
    onClose()
    showToast(`🐷 ${rupees(paise)} into ${goal.name}`, () => db.contributions.delete(row.id))
  }

  const quick = [100, 500, 1000].map((n) => ({ label: rupees(n * 100), value: String(n) }))
  if (remaining > 0) quick.push({ label: `All ${rupees(remaining)} left`, value: String(remaining / 100) })

  return (
    <Sheet title={`${goal.emoji || '🎯'} Add to ${goal.name}`} onClose={onClose}>
      <AmountField value={amount} onChange={(v) => { setAmount(v); setError(null) }} autoFocus quick={quick} />
      <p className="muted small">
        {budget
          ? `Comes out of this month's budget. Free to spend after this: ${rupees(budget.free - paise)}.`
          : 'Tip: set a monthly budget to see how this fits in.'}
      </p>
      {budget && budget.free - paise < 0 && <p className="error">That's more than you have free this month, but you can still do it.</p>}
      {error && <p className="error">{error}</p>}
      <div className="sheet-actions">
        <span className="grow" />
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save}>Add money</button>
      </div>
    </Sheet>
  )
}

// The goal was bought: log it as spending, paid from savings first.
export function BuySheet({ goal, today, onClose, showToast }) {
  const [price, setPrice] = useState(toInput(goal.targetPaise))
  const [error, setError] = useState(null)
  const paise = parseRupees(price) || 0
  const fromSavings = Math.min(paise, goal.stats.saved)
  const extra = paise - fromSavings

  async function save() {
    if (!paise) return setError('Enter what you paid.')
    await buyGoal(goal, paise, goal.stats.saved, today)
    navigator.vibrate?.([10, 40, 10])
    onClose()
    showToast(`🎉 Bought ${goal.name}!`)
  }

  return (
    <Sheet title={`🎉 Bought ${goal.name}?`} onClose={onClose}>
      <AmountField label="What you paid (₹)" value={price} onChange={(v) => { setPrice(v); setError(null) }} autoFocus />
      <p className="muted small">
        {rupees(fromSavings)} comes from your savings.{' '}
        {extra > 0 ? `The other ${rupees(extra)} comes out of this month's budget.` : "This month's budget isn't touched."}{' '}
        It's added to your spending so your summaries stay complete.
      </p>
      {error && <p className="error">{error}</p>}
      <div className="sheet-actions">
        <span className="grow" />
        <button className="btn" onClick={onClose}>Not yet</button>
        <button className="btn primary" onClick={save}>Yes, bought it</button>
      </div>
    </Sheet>
  )
}
