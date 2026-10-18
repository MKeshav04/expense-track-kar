import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { exportCSV, exportJSON, importJSON } from '../lib/backup.js'
import { db, getSetting } from '../lib/db.js'
import { categoryColor } from '../lib/format.js'

function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cat'
}

function CategoryRow({ cat, categories, index, count, showToast }) {
  const [name, setName] = useState(cat.name)
  const [emoji, setEmoji] = useState(cat.emoji)
  const [aliases, setAliases] = useState((cat.aliases || []).join(', '))

  async function saveName() {
    const clean = name.trim()
    if (!clean || clean === cat.name) return setName(cat.name)
    if (categories.some((c) => c.id !== cat.id && c.name.toLowerCase() === clean.toLowerCase())) {
      showToast('That name is already used')
      return setName(cat.name)
    }
    await db.categories.update(cat.id, { name: clean })
  }

  async function swap(dir) {
    const other = categories[index + dir]
    if (!other) return
    await db.transaction('rw', db.categories, async () => {
      await db.categories.update(cat.id, { order: other.order })
      await db.categories.update(other.id, { order: cat.order })
    })
  }

  return (
    <li className={cat.archived ? 'cat-row archived' : 'cat-row'} style={{ '--c': categoryColor(cat.id) }}>
      <div className="cat-line">
        <input
          className="emoji-input"
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          onBlur={() => emoji.trim() && db.categories.update(cat.id, { emoji: emoji.trim() })}
          aria-label="Emoji"
        />
        <input
          className="grow"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          aria-label="Category name"
        />
        <button className="icon-btn" onClick={() => swap(-1)} disabled={index === 0} aria-label="Move up">↑</button>
        <button className="icon-btn" onClick={() => swap(1)} disabled={index === count - 1} aria-label="Move down">↓</button>
      </div>
      <div className="cat-line">
        <input
          className="grow small-input"
          value={aliases}
          placeholder="Other words for it, e.g. lunch, chai"
          onChange={(e) => setAliases(e.target.value)}
          onBlur={() =>
            db.categories.update(cat.id, {
              aliases: aliases.split(',').map((a) => a.trim().toLowerCase()).filter(Boolean),
            })
          }
          aria-label="Other words"
        />
        <button className="btn small" onClick={() => db.categories.update(cat.id, { archived: !cat.archived })}>
          {cat.archived ? 'Show' : 'Hide'}
        </button>
      </div>
    </li>
  )
}

export default function SettingsScreen({ categories, showToast, theme, toggleTheme }) {
  const [newName, setNewName] = useState('')
  const [newEmoji, setNewEmoji] = useState('🏷️')
  const [persisted, setPersisted] = useState(null)
  const fileRef = useRef()
  const lastBackupAt = useLiveQuery(() => getSetting('lastBackupAt'), [], null)
  const entryCount = useLiveQuery(() => db.expenses.count(), [], 0)

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(false))
  }, [])

  async function addCategory(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      showToast('That name is already used')
      return
    }
    let id = slug(name)
    while (categories.some((c) => c.id === id)) id += '-1'
    const order = Math.max(0, ...categories.map((c) => c.order)) + 1
    await db.categories.add({ id, name, emoji: newEmoji || '🏷️', aliases: [], order, archived: false })
    setNewName('')
    setNewEmoji('🏷️')
  }

  async function onImport(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const n = await importJSON(file)
      showToast(`Restored ${n} entries`)
    } catch (err) {
      showToast(err.message || 'Could not read that file')
    }
  }

  return (
    <>
      <section className="card">
        <h2>Look</h2>
        <div className="row">
          <span className="grow">{theme === 'dark' ? '🌙 Dark mode' : '☀️ Light mode'}</span>
          <button className="btn small" onClick={toggleTheme}>
            Switch to {theme === 'dark' ? 'light' : 'dark'}
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Categories</h2>
        <p className="muted small">
          Type a category name or one of its other words after an amount, like <code>150 food</code>.
          Hidden categories keep their history.
        </p>
        <ul className="cat-list">
          {categories.map((c, i) => (
            <CategoryRow
              key={c.id + c.order}
              cat={c}
              categories={categories}
              index={i}
              count={categories.length}
              showToast={showToast}
            />
          ))}
        </ul>
        <form className="cat-line" onSubmit={addCategory}>
          <input className="emoji-input" value={newEmoji} onChange={(e) => setNewEmoji(e.target.value)} aria-label="New emoji" />
          <input className="grow" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New category" />
          <button className="btn primary small" type="submit">Add</button>
        </form>
      </section>

      <section className="card">
        <h2>Backup</h2>
        <p className="muted small">
          {entryCount} entries on this phone. Last backup:{' '}
          {lastBackupAt ? new Date(lastBackupAt).toLocaleDateString('en-IN') : 'never'}.
          Save the backup file to Google Drive or send it to yourself on WhatsApp.
        </p>
        <div className="row wrap">
          <button className="btn primary" onClick={exportJSON}>Back up (JSON)</button>
          <button className="btn" onClick={exportCSV}>Export for Excel (CSV)</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>Restore from backup</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onImport} />
        </div>
      </section>

      <section className="card">
        <h2>Your data</h2>
        <p className="small">
          Everything is stored in this phone's browser database. Nobody else, including whoever shared
          this app with you, can see it.
        </p>
        <p className="small">
          Permanent storage: <strong>{persisted === null ? '…' : persisted ? 'on' : 'not granted yet'}</strong>.
          {persisted === false && ' Installing the app to your home screen usually turns it on.'}
        </p>
        <p className="small muted">
          The AI only gets your summary totals when you tap “Summarise”, and the note of an entry it
          couldn’t sort. It never sees your full list.
        </p>
      </section>
    </>
  )
}
