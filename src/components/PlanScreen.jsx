import { useState } from 'react'
import { monthKey } from '../lib/budget.js'
import { dayLabel, fromISO, toISO, todayISO } from '../lib/dates.js'
import { db, payPlanned } from '../lib/db.js'
import { categoryColor, categoryOf, rupees } from '../lib/format.js'
import { usePlan } from '../lib/usePlan.js'
import { BudgetBreakdown, BudgetCta, BudgetSheet } from './BudgetCard.jsx'
import { BuySheet, GoalSheet, MoneySheet, PlannedSheet } from './PlanSheets.jsx'

const ordinal = (n) => `${n}${[, 'st', 'nd', 'rd'][(n % 100 >> 3) ^ 1 && n % 10] || 'th'}`
const shortDate = (iso) => fromISO(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

function plannedSub(p) {
  const s = p.status
  if (s.paid) return `Paid ${rupees(s.paidExpense.amountPaise)} · ${dayLabel(s.paidExpense.date)}`
  if (p.repeat === 'monthly') {
    const due = p.dueDay ? `due ${ordinal(p.dueDay)}` : 'this month'
    return s.overdue ? `Overdue · was due ${ordinal(p.dueDay)}` : `Every month · ${due}`
  }
  if (!p.dueDate) return 'To buy'
  return s.overdue ? `Overdue · was by ${shortDate(p.dueDate)}` : `To buy · by ${shortDate(p.dueDate)}`
}

function PlannedRow({ p, categories, onEdit, onPay }) {
  const cat = categoryOf(categories, p.categoryId)
  const cls = ['entry', 'plan-row', p.status.paid && 'paid', p.status.overdue && 'overdue'].filter(Boolean).join(' ')
  return (
    <li className={cls} style={{ '--c': categoryColor(p.categoryId) }}>
      <button className="entry-main" onClick={() => onEdit(p)}>
        <span className="entry-emoji" aria-hidden>{p.status.paid ? '✓' : cat.emoji}</span>
        <span className="entry-text">
          <span className="entry-title">{p.name}</span>
          <span className="entry-sub">{plannedSub(p)}</span>
        </span>
        <span className="entry-amount">{rupees(p.amountPaise)}</span>
      </button>
      {!p.status.paid && (
        <button className="pay-btn" onClick={() => onPay(p)}>
          {p.repeat === 'monthly' ? 'Paid ✓' : 'Bought ✓'}
        </button>
      )}
    </li>
  )
}

function GoalCard({ g, onEdit, onMoney, onBuy }) {
  const s = g.stats
  let sub
  if (s.reached) sub = 'Goal reached! Time to treat yourself 🎉'
  else if (s.monthsToGo) sub = `${rupees(s.remaining)} to go · about ${s.monthsToGo} more ${s.monthsToGo === 1 ? 'month' : 'months'} at ~${rupees(Math.round(s.pace / 100) * 100)}/month (${s.etaLabel})`
  else sub = `${rupees(s.remaining)} to go · add any amount, any time`
  return (
    <div className={s.reached ? 'goal reached' : 'goal'}>
      <button className="goal-top" onClick={() => onEdit(g)}>
        <span className="goal-emoji" aria-hidden>{g.emoji || '🎯'}</span>
        <span className="goal-name">{g.name}</span>
        <span className="goal-amt">
          <strong>{rupees(s.saved)}</strong> / {rupees(g.targetPaise)}
        </span>
      </button>
      <div className="goal-bar" aria-label={`${s.pct}% saved`}>
        <span style={{ width: `${s.pct}%` }} />
      </div>
      <div className="goal-sub">
        {s.thisMonth > 0 && <b>{rupees(s.thisMonth)} this month · </b>}
        {sub}
      </div>
      <div className="row goal-actions">
        {!s.reached && <button className="btn primary small" onClick={() => onMoney(g)}>+ Add money</button>}
        {(s.reached || s.saved > 0) && (
          <button className={s.reached ? 'btn primary small' : 'btn small'} onClick={() => onBuy(g)}>Bought it</button>
        )}
      </div>
    </div>
  )
}

export default function PlanScreen({ categories, showToast }) {
  const today = todayISO()
  const plan = usePlan(today)
  const [sheet, setSheet] = useState(null)

  if (!plan) return <div className="loading">Loading…</div>

  const order = (p) => (p.status.overdue ? 0 : 1)
  const due = plan.planned
    .filter((p) => p.status.dueNow && !p.status.paid)
    .sort((a, b) => order(a) - order(b) || (a.dueDay || 32) - (b.dueDay || 32))
  const later = plan.planned.filter((p) => p.status.later)
  const paid = plan.planned.filter((p) => p.status.paid && monthKey(p.status.paidExpense.date) === plan.month)
  const reserved = due.reduce((s, p) => s + p.amountPaise, 0)
  const activeGoals = plan.goals.filter((g) => !g.doneAt)
  const doneGoals = plan.goals.filter((g) => g.doneAt)
  const close = () => setSheet(null)

  async function pay(p) {
    const row = await payPlanned(p, today)
    navigator.vibrate?.(12)
    showToast(`${p.name} ${p.repeat === 'monthly' ? 'paid' : 'bought'} · ${rupees(p.amountPaise)} logged`, () => db.expenses.delete(row.id))
  }

  return (
    <>
      <header className="screen-head">
        <h1>Plan</h1>
        <p className="muted small">
          Bills and must-buys are kept aside from your budget. Savings goals take money out of it, a bit each month.
        </p>
      </header>

      {plan.budget ? (
        <BudgetBreakdown budget={plan.budget} today={today} onEdit={() => setSheet({ type: 'budget' })} />
      ) : (
        <BudgetCta onClick={() => setSheet({ type: 'budget' })} />
      )}

      <section className="card">
        <div className="card-head">
          <h2>📌 Coming up</h2>
          {reserved > 0 && <span className="pill">{rupees(reserved)} kept aside</span>}
        </div>
        {plan.planned.length === 0 && (
          <p className="muted small">
            Add what you'll definitely pay: rent, Netflix, recharge, a gift, new shoes. The money stays kept aside
            until it's paid, so you never accidentally spend it. Typing “199 netflix” on the Add screen marks it paid.
          </p>
        )}
        {due.length > 0 && (
          <ul className="plan-list">
            {due.map((p) => <PlannedRow key={p.id} p={p} categories={categories} onEdit={(x) => setSheet({ type: 'planned', item: x })} onPay={pay} />)}
          </ul>
        )}
        {due.length === 0 && plan.planned.length > 0 && <p className="muted small">All paid for this month 🙌</p>}
        {later.length > 0 && (
          <>
            <h3 className="sub-head">Later</h3>
            <ul className="plan-list">
              {later.map((p) => <PlannedRow key={p.id} p={p} categories={categories} onEdit={(x) => setSheet({ type: 'planned', item: x })} onPay={pay} />)}
            </ul>
          </>
        )}
        {paid.length > 0 && (
          <>
            <h3 className="sub-head">Paid this month</h3>
            <ul className="plan-list">
              {paid.map((p) => <PlannedRow key={p.id} p={p} categories={categories} onEdit={(x) => setSheet({ type: 'planned', item: x })} onPay={pay} />)}
            </ul>
          </>
        )}
        <button className="add-row" onClick={() => setSheet({ type: 'planned' })}>+ Add a bill or to-buy</button>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>🐷 Savings goals</h2>
        </div>
        {activeGoals.length === 0 && (
          <p className="muted small">
            Saving up for something? Add it, then put money in whenever you can — ₹500 one month, ₹1,000 the next.
          </p>
        )}
        <div className="goals">
          {activeGoals.map((g) => (
            <GoalCard
              key={g.id}
              g={g}
              onEdit={(x) => setSheet({ type: 'goal', goal: x })}
              onMoney={(x) => setSheet({ type: 'money', goal: x })}
              onBuy={(x) => setSheet({ type: 'buy', goal: x })}
            />
          ))}
        </div>
        <button className="add-row" onClick={() => setSheet({ type: 'goal' })}>+ New savings goal</button>
        {doneGoals.length > 0 && (
          <details className="done-goals">
            <summary>Bought 🎉 ({doneGoals.length})</summary>
            <ul>
              {doneGoals.map((g) => (
                <li key={g.id}>
                  <span>{g.emoji || '🎯'} {g.name}</span>
                  <span className="muted">{rupees(g.stats.saved)} saved · {dayLabel(toISO(new Date(g.doneAt)))}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {sheet?.type === 'budget' && (
        <BudgetSheet current={plan.budgetPaise} month={plan.month} today={today} onClose={close} showToast={showToast} />
      )}
      {sheet?.type === 'planned' && <PlannedSheet item={sheet.item} categories={categories} onClose={close} showToast={showToast} />}
      {sheet?.type === 'goal' && <GoalSheet goal={sheet.goal} contributions={plan.contributions} onClose={close} showToast={showToast} />}
      {sheet?.type === 'money' && <MoneySheet goal={sheet.goal} budget={plan.budget} today={today} onClose={close} showToast={showToast} />}
      {sheet?.type === 'buy' && <BuySheet goal={sheet.goal} today={today} onClose={close} showToast={showToast} />}
    </>
  )
}
