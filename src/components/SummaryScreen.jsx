import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { aiSummary } from '../lib/ai.js'
import { fromISO, todayISO } from '../lib/dates.js'
import { budgetCost, budgetFor, monthKey } from '../lib/budget.js'
import { db, getSetting } from '../lib/db.js'
import { categoryColor, categoryOf, percent, rupees } from '../lib/format.js'
import {
  compareLabel, computeSummary, funFacts, periodLabel, periodRange, shiftAnchor, statsForAI, summaryText,
} from '../lib/stats.js'
import EntryList from './EntryList.jsx'

const PERIODS = [
  { id: 'day', label: 'Today' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
]

export default function SummaryScreen({ categories, onEdit }) {
  const today = todayISO()
  const [period, setPeriod] = useState('month')
  const [anchor, setAnchor] = useState(today)
  const [picked, setPicked] = useState(undefined) // a categoryId, or null for uncategorised
  const [ai, setAi] = useState({})

  const { start, end } = periodRange(period, anchor)
  const prevStart = periodRange(period, shiftAnchor(period, anchor, -1)).start
  const rows = useLiveQuery(
    () => db.expenses.where('date').between(prevStart, end, true, true).toArray(),
    [prevStart, end],
  )
  const monthInfo = useLiveQuery(async () => {
    if (period !== 'month') return null
    const [budgets, budgetDefault, contributions] = await Promise.all([
      getSetting('budgets', {}),
      getSetting('budgetDefault'),
      db.contributions.where('date').between(start, end, true, true).toArray(),
    ])
    return { budgets, budgetDefault, contributions }
  }, [period, start, end])

  if (!rows) return <div className="loading">Loading…</div>

  const s = computeSummary(rows, period, anchor, today)
  const label = periodLabel(period, anchor, today)
  const key = `${period}:${start}`
  const aiState = ai[key] || {}
  const canGoNext = shiftAnchor(period, anchor, 1) <= today
  const maxDay = Math.max(1, ...s.daily.map((d) => d.total))
  const change = s.prevTotal ? Math.round(((s.total - s.prevTotal) / s.prevTotal) * 100) : null
  const facts = funFacts(s, today)

  // Budget for this month, if one was set: what's left after spending and saving.
  let mb = null
  const monthBudget = period === 'month' && monthInfo ? budgetFor(monthInfo, monthKey(start), monthKey(today)) : null
  if (monthBudget != null) {
    const spentFromBudget = s.rows.reduce((a, e) => a + budgetCost(e), 0)
    const saved = monthInfo.contributions.reduce((a, c) => a + c.amountPaise, 0)
    mb = { budget: monthBudget, saved, left: monthBudget - spentFromBudget - saved }
  }

  function choosePeriod(p) {
    setPeriod(p)
    setAnchor(today)
    setPicked(undefined)
  }

  function move(dir) {
    setAnchor((a) => shiftAnchor(period, a, dir))
    setPicked(undefined)
  }

  async function runAI() {
    setAi((m) => ({ ...m, [key]: { loading: true } }))
    try {
      const text = await aiSummary(statsForAI(s, categories, label, mb))
      setAi((m) => ({ ...m, [key]: { text } }))
    } catch (err) {
      setAi((m) => ({ ...m, [key]: { error: err.message } }))
    }
  }

  async function share() {
    const text = [summaryText(s, categories, label), aiState.text].filter(Boolean).join('\n\n')
    try {
      if (navigator.share) {
        await navigator.share({ text })
        return
      }
    } catch (err) {
      if (err?.name === 'AbortError') return
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }

  const pickedRows = picked === undefined ? [] : s.rows.filter((e) => (e.categoryId ?? null) === picked)

  return (
    <>
      <div className="segmented" role="tablist">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            role="tab"
            aria-selected={period === p.id}
            className={period === p.id ? 'seg active' : 'seg'}
            onClick={() => choosePeriod(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="period-nav">
        <button className="icon-btn" onClick={() => move(-1)} aria-label="Previous">‹</button>
        <span className="period-label">{label}</span>
        <button className="icon-btn" onClick={() => move(1)} disabled={!canGoNext} aria-label="Next">›</button>
      </div>

      <div className="receipt-wrap">
        <section className="receipt">
          <div className="receipt-head">KHARCHA · {label.toUpperCase()}</div>
          <div className="receipt-total">{rupees(s.total)}</div>
          <div className="receipt-rows">
            <div><span>Entries</span><span>{s.count}</span></div>
            {period !== 'day' && s.daysElapsed > 0 && (
              <div><span>Per day</span><span>{rupees(Math.round(s.total / s.daysElapsed / 100) * 100)}</span></div>
            )}
            <div>
              <span>By {compareLabel(period)}</span>
              <span>
                {s.prevTotal === 0 ? '—' : rupees(s.prevTotal)}
                {change !== null && change !== 0 && (
                  <b className={change > 0 ? 'up' : 'down'}> {change > 0 ? '▲' : '▼'}{Math.abs(change)}%</b>
                )}
              </span>
            </div>
            {mb && (
              <>
                <div className="receipt-sep"><span>Budget</span><span>{rupees(mb.budget)}</span></div>
                {mb.saved > 0 && <div><span>Saved to goals</span><span>{rupees(mb.saved)}</span></div>}
                <div>
                  <span>{mb.left < 0 ? 'Over budget' : 'Left'}</span>
                  <b className={mb.left < 0 ? 'up' : 'down'}>{rupees(Math.abs(mb.left))}</b>
                </div>
              </>
            )}
          </div>
          <div className="receipt-foot">{s.count ? '* thank you for tracking *' : '* nothing logged yet *'}</div>
        </section>
      </div>

      {s.count > 0 && (
        <>
          {facts.length > 0 && (
            <div className="facts">
              {facts.map((f, i) => (
                <div key={i} className="fact">
                  <span className="fact-icon" aria-hidden>{f.icon}</span>
                  <span className="fact-big">{f.big}</span>
                  <span className="fact-small">{f.small}</span>
                </div>
              ))}
            </div>
          )}

          <section className="card">
            <h2>Where it went</h2>
            <div className="stack" aria-hidden>
              {s.categories.map((c) => (
                <span
                  key={String(c.categoryId)}
                  style={{ width: `${(c.total / s.total) * 100}%`, background: categoryColor(c.categoryId) }}
                />
              ))}
            </div>
            <ul className="bars">
              {s.categories.map((c) => {
                const cat = categoryOf(categories, c.categoryId)
                const open = picked === c.categoryId
                return (
                  <li key={String(c.categoryId)} style={{ '--c': categoryColor(c.categoryId) }}>
                    <button
                      className={open ? 'bar-row open' : 'bar-row'}
                      onClick={() => setPicked(open ? undefined : c.categoryId)}
                      aria-expanded={open}
                    >
                      <span className="bar-emoji" aria-hidden>{cat.emoji}</span>
                      <span className="bar-name">{cat.name}</span>
                      <span className="bar-pct">{percent(c.total, s.total)}%</span>
                      <span className="bar-amt">{rupees(c.total)}</span>
                    </button>
                    {open && (
                      <div className="drill">
                        <EntryList entries={pickedRows} categories={categories} onEdit={onEdit} />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>

          {s.daily.length > 0 && (
            <section className="card">
              <h2>Day by day</h2>
              <div className={`daily daily-${period}`}>
                {s.daily.map((d) => (
                  <div
                    key={d.date}
                    className={d.date > today ? 'day-col future' : d.date === today ? 'day-col today' : 'day-col'}
                    title={`${d.date}: ${rupees(d.total)}`}
                  >
                    <span className="day-bar" style={{ height: `${(d.total / maxDay) * 100}%` }} />
                    <span className="day-tick">
                      {period === 'week'
                        ? fromISO(d.date).toLocaleDateString('en-IN', { weekday: 'narrow' })
                        : [1, 10, 20].includes(fromISO(d.date).getDate()) ? fromISO(d.date).getDate() : ''}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {s.count > 1 && (
            <section className="card">
              <h2>Biggest</h2>
              <EntryList entries={s.top} categories={categories} onEdit={onEdit} flat />
            </section>
          )}

          <section className="ai">
            <div className="ai-avatar" aria-hidden>✨</div>
            <div className="bubble">
              <div className="bubble-title">Kharcha says</div>
              {aiState.text && <p className="ai-text">{aiState.text}</p>}
              {aiState.error && <p className="error">{aiState.error}</p>}
              {!aiState.text && !aiState.error && (
                <p className="muted small">Want the story behind these numbers? I'll read your totals and tell you.</p>
              )}
              <div className="row">
                <button className="btn primary" onClick={runAI} disabled={aiState.loading}>
                  {aiState.loading ? 'Thinking…' : aiState.text ? 'Try again' : `Summarise ${period === 'day' ? 'today' : 'this ' + period}`}
                </button>
                <button className="btn" onClick={share}>Share</button>
              </div>
            </div>
          </section>
          <p className="muted small center">Only these totals go to the AI, never your list of entries.</p>
        </>
      )}
    </>
  )
}
