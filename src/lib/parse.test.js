import { describe, expect, it } from 'vitest'
import { learnableWords, parseInput } from './parse.js'
import { DEFAULT_CATEGORIES, SEED_KEYWORDS } from './seed.js'

const keywords = new Map()
for (const [categoryId, words] of Object.entries(SEED_KEYWORDS)) {
  for (const w of words) keywords.set(w, { categoryId, count: 5 })
}
// 2026-10-19 is a Monday.
const ctx = { categories: DEFAULT_CATEGORIES, keywords, today: '2026-10-19' }
const one = (text) => {
  const r = parseInput(text, ctx)
  expect(r.error).toBeNull()
  expect(r.entries).toHaveLength(1)
  return r.entries[0]
}

describe('amount + category', () => {
  it.each([
    ['150 food', 15000, 'food', ''],
    ['food 150', 15000, 'food', ''],
    ['₹150 on food', 15000, 'food', ''],
    ['Rs. 150 food', 15000, 'food', ''],
    ['rs150 food', 15000, 'food', ''],
    ['150rs food', 15000, 'food', ''],
    ['spent 150 on food', 15000, 'food', ''],
    ['1k shopping', 100000, 'shopping', ''],
    ['1.5k myntra', 150000, 'shopping', 'myntra'],
    ['1,000 shopping', 100000, 'shopping', ''],
    ['1,00,000 rent', 10000000, 'bills', 'rent'],
    ['zomato 340', 34000, 'food', 'zomato'],
    ['99.50 chai', 9950, 'food', 'chai'],
    ['500 Care', 50000, 'care', ''],
    ['60 eating out', 6000, 'food', ''],
  ])('%s', (text, amountPaise, categoryId, note) => {
    const e = one(text)
    expect(e.amountPaise).toBe(amountPaise)
    expect(e.categoryId).toBe(categoryId)
    expect(e.note).toBe(note)
    expect(e.date).toBe('2026-10-19')
  })

  it('takes the price, not the quantity', () => {
    expect(one('2 coffees 300').amountPaise).toBe(30000)
    expect(one('paid 40 for 2 chai').amountPaise).toBe(4000)
  })

  it('prefers the number marked with ₹', () => {
    expect(one('3 shirts ₹1200').amountPaise).toBe(120000)
    expect(one('order 5000 ₹450 swiggy').amountPaise).toBe(45000)
  })

  it('matches one-letter typos on longer words only', () => {
    expect(one('150 fodo').categoryId).toBe('food')
    expect(one('300 shoping').categoryId).toBe('shopping')
    expect(one('500 car service').categoryId).toBeNull()
  })

  it('leaves unknown text uncategorised', () => {
    const e = one('dinner w rohan 340')
    expect(e.categoryId).toBe('food') // "dinner" is a Food alias
    const u = one('340 xyz thing')
    expect(u.categoryId).toBeNull()
    expect(u.source).toBe('none')
    expect(u.note).toBe('xyz thing')
  })

  it('ignores keyword memory below the trust threshold', () => {
    const k = new Map([['team', { categoryId: 'food', count: 1 }]])
    expect(parseInput('2000 team outing x', { ...ctx, keywords: k }).entries[0].categoryId).toBe('fun')
    const k2 = new Map([['rohan', { categoryId: 'fun', count: 1 }]])
    expect(parseInput('200 rohan', { ...ctx, keywords: k2 }).entries[0].categoryId).toBeNull()
  })
})

describe('dates', () => {
  it.each([
    ['200 auto yesterday', '2026-10-18'],
    ['200 auto yday', '2026-10-18'],
    ['200 auto day before yesterday', '2026-10-17'],
    ['200 auto 3 days ago', '2026-10-16'],
    ['200 auto sat', '2026-10-17'],
    ['200 auto mon', '2026-10-12'],
    ['200 auto 15/10', '2026-10-15'],
    ['200 auto 25/12', '2025-12-25'],
    ['200 auto 01/10/26', '2026-10-01'],
  ])('%s', (text, date) => {
    const e = one(text)
    expect(e.date).toBe(date)
    expect(e.amountPaise).toBe(20000)
    expect(e.categoryId).toBe('transport')
    expect(e.note).toBe('auto')
  })
})

describe('several entries per line', () => {
  it('splits on commas and "and"', () => {
    const r = parseInput('150 food, 1k shopping and 40 auto', ctx)
    expect(r.error).toBeNull()
    expect(r.entries.map((e) => [e.amountPaise, e.categoryId])).toEqual([
      [15000, 'food'],
      [100000, 'shopping'],
      [4000, 'transport'],
    ])
  })

  it('does not split when a part has no amount', () => {
    const e = one('bread and butter 60')
    expect(e.amountPaise).toBe(6000)
    expect(e.note).toBe('bread and butter')
  })

  it('keeps thousands commas inside a multi-entry line', () => {
    const r = parseInput('1,200 shoes, 300 food', ctx)
    expect(r.entries.map((e) => e.amountPaise)).toEqual([120000, 30000])
  })
})

describe('errors', () => {
  it('rejects text with no amount', () => {
    expect(parseInput('food', ctx).error).toMatch(/amount/)
  })
  it('rejects zero', () => {
    expect(parseInput('0 food', ctx).error).toMatch(/more than/)
  })
  it('returns nothing for empty input', () => {
    expect(parseInput('   ', ctx)).toEqual({ entries: [], error: null })
  })
})

describe('learnableWords', () => {
  it('drops filler, numbers and generic words', () => {
    expect(learnableWords('lunch w team at taj 2')).toEqual(['lunch', 'taj'])
  })
})
