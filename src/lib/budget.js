import { addMonths, daysBetween, monthEnd, monthLabel, toISO } from './dates.js'

// Pure maths for the monthly budget, the "Coming up" list (bills + to-buys) and savings goals.
// No database here, so it's easy to test.

export const monthKey = (iso) => iso.slice(0, 7)

const sum = (xs) => xs.reduce((s, x) => s + x, 0)

// Budget for a month: an explicit value, or (for the current month only) the "every month" default.
export function budgetFor(settings, month, currentMonth) {
  const explicit = settings.budgets?.[month]
  if (explicit != null) return explicit
  if (month === currentMonth) return settings.budgetDefault ?? null
  return null
}

// The part of an expense paid from this month's budget. Money taken from savings is not.
export const budgetCost = (e) => e.amountPaise - (e.fromSavingsPaise || 0)

// Where a planned item stands this month. `linked` = expenses whose plannedId is this item.
export function plannedStatus(item, linked, today) {
  const month = monthKey(today)
  if (item.repeat === 'monthly') {
    const paidExpense = linked.find((e) => monthKey(e.date) === month) || null
    const day = Number(today.slice(8))
    return {
      paid: !!paidExpense,
      paidExpense,
      dueNow: true,
      later: false,
      overdue: !paidExpense && !!item.dueDay && day > item.dueDay,
    }
  }
  const paidExpense = [...linked].sort((a, b) => (a.date < b.date ? 1 : -1))[0] || null
  const later = !paidExpense && !!item.dueDate && item.dueDate > monthEnd(today)
  return {
    paid: !!paidExpense,
    paidExpense,
    dueNow: !later,
    later,
    overdue: !paidExpense && !!item.dueDate && item.dueDate < today,
  }
}

// planned: items with a .status from plannedStatus().
export function computeBudget({ budgetPaise, monthExpenses, monthContributions, planned, today }) {
  const spent = sum(monthExpenses.map(budgetCost))
  const saved = sum(monthContributions.map((c) => c.amountPaise))
  const bills = planned.filter((p) => p.status.dueNow && !p.status.paid)
  const reserved = sum(bills.map((p) => p.amountPaise))
  const left = budgetPaise - spent - saved
  const free = left - reserved
  const daysLeft = daysBetween(today, monthEnd(today)) + 1
  const perDay = free > 0 ? Math.floor(free / daysLeft / 100) * 100 : 0
  return { budget: budgetPaise, spent, saved, reserved, billsCount: bills.length, left, free, daysLeft, perDay, over: left < 0 }
}

const words = (s) => (s || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3)

// Does a newly typed entry pay one of the unpaid planned items? ("199 netflix" → Netflix)
// Every word of the item's name must appear in what was typed.
export function matchPlanned(entry, planned, today) {
  const typed = new Set(words(`${entry.note} ${entry.rawText}`))
  return (
    planned.find((p) => {
      if (p.status.paid) return false
      if (p.repeat === 'monthly' && monthKey(entry.date) !== monthKey(today)) return false
      const need = words(p.name)
      return need.length > 0 && need.every((w) => typed.has(w))
    }) || null
  )
}

const monthsBetween = (a, b) => {
  const [y1, m1] = a.split('-').map(Number)
  const [y2, m2] = b.split('-').map(Number)
  return (y2 - y1) * 12 + (m2 - m1)
}

export function goalStats(goal, contributions, today) {
  const mine = contributions.filter((c) => c.goalId === goal.id)
  const saved = sum(mine.map((c) => c.amountPaise))
  const month = monthKey(today)
  const thisMonth = sum(mine.filter((c) => monthKey(c.date) === month).map((c) => c.amountPaise))
  const remaining = Math.max(0, goal.targetPaise - saved)
  const months = monthsBetween(monthKey(toISO(new Date(goal.createdAt))), month) + 1
  const pace = saved > 0 ? Math.round(saved / months) : 0
  const monthsToGo = remaining === 0 ? 0 : pace > 0 ? Math.ceil(remaining / pace) : null
  return {
    saved,
    thisMonth,
    remaining,
    pct: goal.targetPaise ? Math.min(100, Math.round((saved / goal.targetPaise) * 100)) : 0,
    pace,
    monthsToGo,
    etaLabel: monthsToGo ? monthLabel(addMonths(today, monthsToGo)) : null,
    reached: remaining === 0,
  }
}

// "1,500", "1.5k", "₹ 500" → paise. Anything else → null.
export function parseRupees(input) {
  const s = String(input ?? '').toLowerCase().replace(/[₹,\s]|rs\.?/g, '')
  const m = s.match(/^(\d+(?:\.\d+)?)(k)?$/)
  if (!m) return null
  const value = Number(m[1]) * (m[2] ? 1000 : 1)
  return value > 0 ? Math.round(value * 100) : null
}
