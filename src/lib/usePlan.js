import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { budgetFor, computeBudget, goalStats, monthKey, plannedStatus } from './budget.js'
import { monthEnd, monthStart } from './dates.js'
import { db, getSetting } from './db.js'

// Everything the budget card and the Plan tab need for the current month, kept live.
export function usePlan(today) {
  const month = monthKey(today)
  const raw = useLiveQuery(async () => {
    const [budgets, budgetDefault, planned, goals, contributions, monthExpenses] = await Promise.all([
      getSetting('budgets', {}),
      getSetting('budgetDefault'),
      db.planned.toArray(),
      db.goals.toArray(),
      db.contributions.toArray(),
      db.expenses.where('date').between(monthStart(today), monthEnd(today), true, true).toArray(),
    ])
    const linked = planned.length ? await db.expenses.where('plannedId').anyOf(planned.map((p) => p.id)).toArray() : []
    return { budgets, budgetDefault, planned, goals, contributions, monthExpenses, linked }
  }, [today])

  return useMemo(() => {
    if (!raw) return null
    const budgetPaise = budgetFor({ budgets: raw.budgets, budgetDefault: raw.budgetDefault }, month, month)
    const planned = raw.planned
      .map((p) => ({ ...p, status: plannedStatus(p, raw.linked.filter((e) => e.plannedId === p.id), today) }))
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    const monthContributions = raw.contributions.filter((c) => monthKey(c.date) === month)
    const goals = raw.goals
      .map((g) => ({ ...g, stats: goalStats(g, raw.contributions, today) }))
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    const budget =
      budgetPaise != null
        ? computeBudget({ budgetPaise, monthExpenses: raw.monthExpenses, monthContributions, planned, today })
        : null
    return {
      month,
      budgetPaise,
      budgetDefault: raw.budgetDefault,
      budget,
      planned,
      goals,
      contributions: raw.contributions,
    }
  }, [raw, month, today])
}
