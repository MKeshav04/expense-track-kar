const nf = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 })

export const rupees = (paise) => '₹' + nf.format(paise / 100)

export const percent = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0)

export const UNCATEGORISED = { id: null, name: 'Uncategorised', emoji: '❓' }

export function categoryOf(categories, id) {
  return categories.find((c) => c.id === id) || UNCATEGORISED
}

const COLORS = {
  food: '#ff8a3d',
  groceries: '#3dbe65',
  transport: '#f5b700',
  shopping: '#ff5fa2',
  bills: '#4f7df5',
  care: '#1fb5a0',
  fun: '#9b5cf6',
  other: '#8e8a80',
}
const EXTRA = ['#e4572e', '#17bebb', '#d65db1', '#76b041', '#2e86ab', '#f08a5d']

// Every category gets a stable colour; custom ones pick from EXTRA by name.
export function categoryColor(id) {
  if (!id) return '#b8b2a7'
  if (COLORS[id]) return COLORS[id]
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return EXTRA[h % EXTRA.length]
}
