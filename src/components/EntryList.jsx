import { dayLabel, todayISO } from '../lib/dates.js'
import { updateEntry } from '../lib/db.js'
import { categoryColor, categoryOf, rupees } from '../lib/format.js'

// flat: keep the given order (e.g. biggest first) with no day headers.
export default function EntryList({ entries, categories, onEdit, highlight = [], showDayTotals, flat }) {
  const today = todayISO()
  const sorted = [...entries].sort((a, b) =>
    a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1,
  )
  const groups = flat ? [{ date: 'all', items: entries }] : []
  for (const e of flat ? [] : sorted) {
    const last = groups[groups.length - 1]
    if (last && last.date === e.date) last.items.push(e)
    else groups.push({ date: e.date, items: [e] })
  }

  return (
    <div className="entries">
      {groups.map((g) => (
        <section key={g.date} className="day">
          {!flat && (
            <h3 className="day-head">
              <span>{dayLabel(g.date, today)}</span>
              {showDayTotals && <span>{rupees(g.items.reduce((s, e) => s + e.amountPaise, 0))}</span>}
            </h3>
          )}
          <ul>
            {g.items.map((e) => {
              const cat = categoryOf(categories, e.categoryId)
              const suggestion = !e.categoryId && e.suggestedCategoryId
                ? categories.find((c) => c.id === e.suggestedCategoryId)
                : null
              return (
                <li
                  key={e.id}
                  className={highlight.includes(e.id) ? 'entry new' : 'entry'}
                  style={{ '--c': categoryColor(e.categoryId) }}
                >
                  <button className="entry-main" onClick={() => onEdit(e)}>
                    <span className={e.categoryId ? 'entry-emoji' : 'entry-emoji unknown'} aria-hidden>{cat.emoji}</span>
                    <span className="entry-text">
                      <span className="entry-title">{e.note || cat.name}</span>
                      <span className="entry-sub">
                        {flat
                          ? [e.note ? cat.name : '', dayLabel(e.date, today)].filter(Boolean).join(' · ')
                          : e.note ? cat.name : e.categoryId ? '' : 'Tap to pick a category'}
                      </span>
                    </span>
                    <span className="entry-amount">{rupees(e.amountPaise)}</span>
                  </button>
                  {suggestion && (
                    <button
                      className="suggest"
                      onClick={() =>
                        updateEntry(e.id, { categoryId: suggestion.id, source: 'llm' }, { categoryChanged: true })
                      }
                    >
                      ✨ {suggestion.emoji} {suggestion.name}?
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
