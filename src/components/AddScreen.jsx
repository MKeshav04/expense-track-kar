import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useRef, useState } from 'react'
import { suggestMissing } from '../lib/ai.js'
import { matchPlanned } from '../lib/budget.js'
import { addDays, dayLabel, daysBetween, todayISO } from '../lib/dates.js'
import { addEntries, db, getSetting, toggleNoSpend } from '../lib/db.js'
import { categoryColor, categoryOf, rupees } from '../lib/format.js'
import { parseInput } from '../lib/parse.js'
import { streak, usualDaily } from '../lib/stats.js'
import { usePlan } from '../lib/usePlan.js'
import BudgetCard, { BudgetCta, BudgetSheet } from './BudgetCard.jsx'
import EntryList from './EntryList.jsx'

const PLACEHOLDERS = ['150 food', '40 chai', '1.2k myntra', '60 auto yesterday', '499 recharge', '250 swiggy, 40 chai']

function mood(todayTotal, usual, noSpendToday) {
  if (todayTotal === 0) return noSpendToday ? 'No-spend day. Streak safe 🎉' : "Nothing yet today. Wallet's resting 😴"
  if (usual === null) return 'Nice. Keep logging and I’ll learn your usual ✍️'
  if (todayTotal < usual * 0.6) return 'Lighter than your usual day 🌱'
  if (todayTotal <= usual * 1.2) return 'About a normal day 👌'
  return 'Pricier than usual today 👀'
}

export default function AddScreen({ categories, keywords, onEdit, showToast, go, theme, toggleTheme }) {
  const [text, setText] = useState('')
  const [error, setError] = useState(null)
  const [days, setDays] = useState(30)
  const [justAdded, setJustAdded] = useState([])
  const [bump, setBump] = useState(0)
  const [budgetOpen, setBudgetOpen] = useState(false)
  const [placeholder] = useState(() => PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)])
  const inputRef = useRef()

  const today = todayISO()
  const active = useMemo(() => categories.filter((c) => !c.archived), [categories])

  const recent = useLiveQuery(
    () => db.expenses.where('date').aboveOrEqual(addDays(today, -Math.max(days, 31))).toArray(),
    [today, days],
    [],
  )
  const plan = usePlan(today)
  const total = useLiveQuery(() => db.expenses.count(), [], 0)
  const lastBackupAt = useLiveQuery(() => getSetting('lastBackupAt'), [], null)
  const loggedDates = useLiveQuery(() => db.expenses.orderBy('date').uniqueKeys(), [], [])
  const noSpendDays = useLiveQuery(() => getSetting('noSpendDays', []), [], [])

  const streakDays = useMemo(
    () => streak(new Set([...loggedDates, ...noSpendDays]), today),
    [loggedDates, noSpendDays, today],
  )
  const usual = useMemo(() => usualDaily(recent, today), [recent, today])
  const shown = useMemo(() => recent.filter((e) => daysBetween(e.date, today) <= days), [recent, days, today])

  // Your most repeated entries from the last 60 days, as one-tap chips.
  const chips = useMemo(() => {
    const counts = new Map()
    for (const e of recent) {
      if (!e.categoryId) continue
      const key = `${e.amountPaise}|${e.categoryId}|${e.note}`
      const c = counts.get(key) || { n: 0, e }
      c.n += 1
      counts.set(key, c)
    }
    return [...counts.values()]
      .filter((c) => c.n >= 2 && categories.some((cat) => cat.id === c.e.categoryId && !cat.archived))
      .sort((a, b) => b.n - a.n)
      .slice(0, 6)
      .map((c) => c.e)
  }, [recent, categories])

  async function save(parsed) {
    // "199 netflix" pays the Netflix bill on the Plan tab, so it isn't counted twice.
    const paid = []
    if (plan) {
      let open = plan.planned
      parsed = parsed.map((p) => {
        const m = matchPlanned(p, open, today)
        if (!m) return p
        open = open.filter((x) => x.id !== m.id)
        paid.push(m.name)
        // Paying a bill: take the bill's category if the typed text didn't give one.
        return p.categoryId ? { ...p, plannedId: m.id } : { ...p, plannedId: m.id, categoryId: m.categoryId, source: 'rule' }
      })
    }
    const rows = await addEntries(parsed)
    navigator.vibrate?.(12)
    setJustAdded(rows.map((r) => r.id))
    setBump((b) => b + 1)
    const first = rows[0]
    const cat = categoryOf(categories, first.categoryId)
    const msg =
      rows.length > 1
        ? `Saved ${rows.length} entries · ${rupees(rows.reduce((s, r) => s + r.amountPaise, 0))}`
        : `${rupees(first.amountPaise)} · ${cat.emoji} ${cat.name} · ${dayLabel(first.date, today)}`
    showToast(paid.length ? `${msg} · 📌 ${paid.join(', ')} paid` : msg, () => db.expenses.bulkDelete(rows.map((r) => r.id)))
    if (rows.some((r) => !r.categoryId)) suggestMissing(categories)
  }

  async function submit(e) {
    e.preventDefault()
    const result = parseInput(text, { categories: active, keywords, today })
    if (result.error) {
      setError(result.error)
      return
    }
    if (!result.entries.length) return
    setError(null)
    setText('')
    await save(result.entries)
    inputRef.current?.focus()
  }

  function addChip(e) {
    save([{ amountPaise: e.amountPaise, categoryId: e.categoryId, note: e.note, rawText: e.rawText, date: today, source: 'manual' }])
  }

  async function noSpend() {
    const on = await toggleNoSpend(today)
    if (on) navigator.vibrate?.([10, 40, 10])
    showToast(on ? 'Marked as a no-spend day 🎉' : 'No-spend mark removed')
  }

  const needsBackup = total >= 20 && (!lastBackupAt || Date.now() - lastBackupAt > 30 * 86400000)
  const todayTotal = recent.filter((e) => e.date === today).reduce((s, e) => s + e.amountPaise, 0)
  const noSpendToday = noSpendDays.includes(today)

  return (
    <>
      <header className="brand">
        <span className="wordmark">
          <span className="coin" aria-hidden>₹</span>kharcha
        </span>
        <span className="brand-right">
          <span className={streakDays ? 'streak' : 'streak cold'} title="Days in a row you've logged">
            🔥 {streakDays} {streakDays === 1 ? 'day' : 'days'}
          </span>
          <button
            className="theme-btn"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </span>
      </header>

      {plan?.budget ? (
        <BudgetCard
          budget={plan.budget}
          today={today}
          bump={bump}
          go={go}
          onEdit={() => setBudgetOpen(true)}
          todayLine={`Today ${rupees(todayTotal)} · ${mood(todayTotal, usual, noSpendToday)}`}
          noSpendButton={
            todayTotal === 0 && (
              <button className={noSpendToday ? 'nospend on' : 'nospend'} onClick={noSpend}>
                {noSpendToday ? '✓ No-spend' : 'Spent nothing?'}
              </button>
            )
          }
        />
      ) : (
        <>
          {plan && <BudgetCta onClick={() => setBudgetOpen(true)} />}
          <section className="hero">
            <div className="hero-top">
              <span className="hero-label">Spent today</span>
              {todayTotal === 0 && (
                <button className={noSpendToday ? 'nospend on' : 'nospend'} onClick={noSpend}>
                  {noSpendToday ? '✓ No-spend day' : 'Spent nothing?'}
                </button>
              )}
            </div>
            <div key={bump} className="hero-amount">{rupees(todayTotal)}</div>
            <div className="hero-mood">
              {mood(todayTotal, usual, noSpendToday)}
              {usual !== null && <span className="hero-usual"> · usual ≈ {rupees(Math.round(usual / 100) * 100)}</span>}
            </div>
          </section>
        </>
      )}

      {budgetOpen && plan && (
        <BudgetSheet
          current={plan.budgetPaise}
          month={plan.month}
          today={today}
          onClose={() => setBudgetOpen(false)}
          showToast={showToast}
        />
      )}

      <form onSubmit={submit} className="quick-add">
        <input
          ref={inputRef}
          className="quick-input"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            if (error) setError(null)
          }}
          placeholder={`try “${placeholder}”`}
          inputMode="text"
          enterKeyHint="done"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          aria-label="New expense"
        />
        <button className="add-btn" type="submit" aria-label="Save">
          Add
        </button>
      </form>
      {error && <p className="error">{error}</p>}

      {chips.length > 0 && (
        <div className="chips" aria-label="Quick add">
          {chips.map((e) => {
            const cat = categoryOf(categories, e.categoryId)
            return (
              <button key={e.id} className="chip" style={{ '--c': categoryColor(e.categoryId) }} onClick={() => addChip(e)}>
                <span aria-hidden>{cat.emoji}</span> {rupees(e.amountPaise)} {e.note || cat.name}
              </button>
            )
          })}
        </div>
      )}

      {needsBackup && (
        <button className="banner" onClick={() => go('settings')}>
          💾 {lastBackupAt ? "It's been a month since your last backup." : "You haven't backed up yet."} Tap to back up.
        </button>
      )}

      {shown.length === 0 ? (
        <div className="empty">
          <div className="empty-art" aria-hidden>🧾</div>
          <p className="empty-title">Your khata is empty</p>
          <p className="muted">Type what you spent, the way you'd text a friend:</p>
          <div className="examples">
            {['150 food', '1.5k myntra', '200 auto yesterday', '150 food, 40 chai'].map((ex) => (
              <button key={ex} className="example" onClick={() => { setText(ex); inputRef.current?.focus() }}>
                {ex}
              </button>
            ))}
          </div>
          <p className="muted small">🔒 Your data stays on this phone. Nobody else can see it.</p>
        </div>
      ) : (
        <EntryList entries={shown} categories={categories} onEdit={onEdit} highlight={justAdded} showDayTotals />
      )}

      {shown.length > 0 && total > shown.length && (
        <button className="link-btn" onClick={() => setDays((d) => d + 60)}>
          Show older entries
        </button>
      )}
    </>
  )
}
