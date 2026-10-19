import { describe, expect, it } from 'vitest'
import { budgetFor, computeBudget, goalStats, matchPlanned, parseRupees, plannedStatus } from './budget.js'

const today = '2026-10-19' // 13 days left in October, including today
const rs = (n) => n * 100

describe('budgetFor', () => {
  const settings = { budgetDefault: rs(5000), budgets: { '2026-09': rs(4000) } }
  it('uses the month value, else the default for the current month only', () => {
    expect(budgetFor(settings, '2026-09', '2026-10')).toBe(rs(4000))
    expect(budgetFor(settings, '2026-10', '2026-10')).toBe(rs(5000))
    expect(budgetFor(settings, '2026-08', '2026-10')).toBeNull()
  })
})

describe('plannedStatus', () => {
  const netflix = { id: 'n', name: 'Netflix', repeat: 'monthly', amountPaise: rs(199), dueDay: 5 }
  it('monthly: paid only by an expense this month', () => {
    expect(plannedStatus(netflix, [{ plannedId: 'n', date: '2026-09-05' }], today)).toMatchObject({
      paid: false, dueNow: true, overdue: true,
    })
    expect(plannedStatus(netflix, [{ plannedId: 'n', date: '2026-10-04' }], today).paid).toBe(true)
  })
  it('one-time: later when dated after this month, overdue when past', () => {
    expect(plannedStatus({ repeat: 'once', dueDate: '2026-11-10' }, [], today)).toMatchObject({ later: true, dueNow: false })
    expect(plannedStatus({ repeat: 'once', dueDate: '2026-10-10' }, [], today)).toMatchObject({ dueNow: true, overdue: true })
    expect(plannedStatus({ repeat: 'once' }, [], today)).toMatchObject({ dueNow: true, overdue: false })
  })
})

describe('computeBudget', () => {
  it('left = budget − spent − saved; free also keeps unpaid bills aside', () => {
    const planned = [
      { amountPaise: rs(199), status: { dueNow: true, paid: false } },
      { amountPaise: rs(299), status: { dueNow: true, paid: true } },
      { amountPaise: rs(1500), status: { dueNow: false, paid: false } },
    ]
    const b = computeBudget({
      budgetPaise: rs(5000),
      monthExpenses: [{ amountPaise: rs(1200) }, { amountPaise: rs(2000), fromSavingsPaise: rs(1800) }],
      monthContributions: [{ amountPaise: rs(500) }],
      planned,
      today,
    })
    expect(b.spent).toBe(rs(1400)) // 1200 + (2000 − 1800 from savings)
    expect(b.saved).toBe(rs(500))
    expect(b.reserved).toBe(rs(199))
    expect(b.billsCount).toBe(1)
    expect(b.left).toBe(rs(3100))
    expect(b.free).toBe(rs(2901))
    expect(b.daysLeft).toBe(13)
    expect(b.perDay).toBe(rs(223)) // 2901 / 13 = 223.15 → rounded down
    expect(b.over).toBe(false)
  })
  it('goes negative when over budget', () => {
    const b = computeBudget({ budgetPaise: rs(1000), monthExpenses: [{ amountPaise: rs(1300) }], monthContributions: [], planned: [], today })
    expect(b.left).toBe(rs(-300))
    expect(b.over).toBe(true)
    expect(b.perDay).toBe(0)
  })
})

describe('matchPlanned', () => {
  const unpaid = { dueNow: true, paid: false }
  const planned = [
    { id: 'n', name: 'Netflix', repeat: 'monthly', status: unpaid },
    { id: 'r', name: 'Jio recharge', repeat: 'monthly', status: unpaid },
    { id: 's', name: 'Running shoes', repeat: 'once', status: unpaid },
  ]
  it('matches when every word of the item name was typed', () => {
    expect(matchPlanned({ note: 'netflix', rawText: '199 netflix', date: today }, planned, today)?.id).toBe('n')
    expect(matchPlanned({ note: 'jio recharge', rawText: '299 jio recharge', date: today }, planned, today)?.id).toBe('r')
    expect(matchPlanned({ note: 'recharge', rawText: '299 recharge', date: today }, planned, today)).toBeNull()
  })
  it('skips paid items and monthly items logged for another month', () => {
    const paid = planned.map((p) => ({ ...p, status: { ...p.status, paid: true } }))
    expect(matchPlanned({ note: 'netflix', rawText: '', date: today }, paid, today)).toBeNull()
    expect(matchPlanned({ note: 'netflix', rawText: '', date: '2026-09-30' }, planned, today)).toBeNull()
    expect(matchPlanned({ note: 'running shoes', rawText: '', date: '2026-09-30' }, planned, today)?.id).toBe('s')
  })
})

describe('goalStats', () => {
  const goal = { id: 'g', targetPaise: rs(2000), createdAt: new Date(2026, 8, 3).getTime() } // 3 Sep
  const contributions = [
    { goalId: 'g', amountPaise: rs(500), date: '2026-09-10' },
    { goalId: 'g', amountPaise: rs(700), date: '2026-10-02' },
    { goalId: 'other', amountPaise: rs(999), date: '2026-10-02' },
  ]
  it('tracks progress, this month, pace and an estimate', () => {
    const s = goalStats(goal, contributions, today)
    expect(s.saved).toBe(rs(1200))
    expect(s.thisMonth).toBe(rs(700))
    expect(s.pct).toBe(60)
    expect(s.pace).toBe(rs(600)) // 1200 over 2 months
    expect(s.monthsToGo).toBe(2) // 800 left at ~600/month
    expect(s.reached).toBe(false)
  })
})

describe('parseRupees', () => {
  it.each([
    ['500', rs(500)], ['1,500', rs(1500)], ['1.5k', rs(1500)], ['₹ 2,000', rs(2000)], ['99.5', 9950],
    ['', null], ['abc', null], ['0', null],
  ])('%s', (input, out) => expect(parseRupees(input)).toBe(out))
})
