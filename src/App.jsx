import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AddScreen from './components/AddScreen.jsx'
import EditSheet from './components/EditSheet.jsx'
import SettingsScreen from './components/SettingsScreen.jsx'
import SummaryScreen from './components/SummaryScreen.jsx'
import { suggestMissing } from './lib/ai.js'
import { db, requestPersistence } from './lib/db.js'
import { getTheme, setTheme } from './lib/theme.js'

const TABS = [
  { id: 'add', label: 'Add', icon: '✍️' },
  { id: 'summary', label: 'Summary', icon: '🧾' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
]

export default function App() {
  // Always open on Add: logging should be one tap away.
  const [tab, setTab] = useState('add')
  const [theme, setThemeState] = useState(getTheme)
  const [editing, setEditing] = useState(null)
  const [toast, setToast] = useState(null)
  const toastTimer = useRef()

  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray(), [], [])
  const keywordRows = useLiveQuery(() => db.keywords.toArray(), [], [])
  const keywords = useMemo(() => new Map(keywordRows.map((k) => [k.word, k])), [keywordRows])

  const showToast = useCallback((message, undo) => {
    clearTimeout(toastTimer.current)
    setToast({ message, undo })
    toastTimer.current = setTimeout(() => setToast(null), undo ? 5000 : 2500)
  }, [])

  const go = (id) => setTab(id)

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    setThemeState(next)
  }

  useEffect(() => {
    requestPersistence()
  }, [])

  // Retry AI category suggestions whenever we come back online.
  useEffect(() => {
    if (!categories.length) return
    const run = () => suggestMissing(categories)
    run()
    window.addEventListener('online', run)
    return () => window.removeEventListener('online', run)
  }, [categories])

  if (!categories.length) return <div className="loading">Loading…</div>

  const shared = { categories, keywords, onEdit: setEditing, showToast, go, theme, toggleTheme }

  return (
    <div className="app">
      <main className="screen">
        {tab === 'add' && <AddScreen {...shared} />}
        {tab === 'summary' && <SummaryScreen {...shared} />}
        {tab === 'settings' && <SettingsScreen {...shared} />}
      </main>

      {toast && (
        <div className="toast" role="status">
          <span>{toast.message}</span>
          {toast.undo && (
            <button
              className="toast-undo"
              onClick={() => {
                toast.undo()
                setToast(null)
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'tab active' : 'tab'}
            onClick={() => go(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
          >
            <span className="tab-icon" aria-hidden>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {editing && (
        <EditSheet
          entry={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          showToast={showToast}
        />
      )}
    </div>
  )
}
