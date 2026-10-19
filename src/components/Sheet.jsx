// Bottom sheet used by the budget, plan and goal forms.
export default function Sheet({ title, onClose, children }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        {title && <h2 className="sheet-title">{title}</h2>}
        {children}
      </div>
    </div>
  )
}

export function AmountField({ label = 'Amount (₹)', value, onChange, autoFocus, quick = [] }) {
  return (
    <div className="field">
      <label>
        <span>{label}</span>
        <input
          className="big-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          placeholder="0"
          autoFocus={autoFocus}
        />
      </label>
      {quick.length > 0 && (
        <div className="quick-amounts">
          {quick.map((q) => (
            <button key={q.label} type="button" className="chip-amount" onClick={() => onChange(q.value)}>
              {q.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
