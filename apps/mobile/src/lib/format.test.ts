import { describe, expect, it, vi } from 'vitest'

vi.mock('expo-secure-store', () => ({ getItemAsync: vi.fn(), setItemAsync: vi.fn() }))

import { guessCategory } from './category'
import {
  addDays,
  dateChip,
  dayHeading,
  groupBy,
  initials,
  money,
  monthName,
  shortDate,
  signedMoney,
  timeAgo,
  toneFor,
} from './format'
import { DEFAULT_PREFS, parsePrefs } from './prefs'

describe('money', () => {
  it('drops .00 on whole amounts and groups rupees the Indian way', () => {
    expect(money(620000, 'INR')).toBe('₹6,200')
    expect(money(12345600, 'INR')).toBe('₹1,23,456')
    expect(money(4200, 'USD')).toBe('$42')
    expect(money(4250, 'USD')).toBe('$42.50')
  })

  it('is always positive; signedMoney adds + or −', () => {
    expect(money(-89000, 'INR')).toBe('₹890')
    expect(signedMoney(-89000, 'INR')).toBe('−₹890')
    expect(signedMoney(150000, 'INR')).toBe('+₹1,500')
    expect(signedMoney(0, 'EUR')).toBe('€0')
  })
})

describe('dates', () => {
  const today = '2026-11-26'
  it('names days in lists', () => {
    expect(dayHeading(today, today)).toBe('Today')
    expect(dayHeading('2026-11-25', today)).toBe('Yesterday')
    expect(dayHeading('2026-11-23', today)).toBe('Monday, 23 Nov')
    expect(dayHeading('2025-12-31', today)).toBe('Wednesday, 31 Dec 2025')
  })

  it('labels chips and short dates', () => {
    expect(dateChip('2026-11-24', today)).toBe('Tue, 24 Nov')
    expect(shortDate('2026-11-03', today)).toBe('3 Nov')
    expect(shortDate('2025-11-03', today)).toBe('3 Nov 2025')
    expect(monthName('2026-10', today)).toBe('October')
    expect(monthName('2025-10', today)).toBe('October 2025')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('says how long ago', () => {
    const now = Date.UTC(2026, 10, 26, 12)
    expect(timeAgo(now - 20 * 60_000, now)).toBe('20 min ago')
    expect(timeAgo(now - 2 * 3_600_000, now)).toBe('2 hours ago')
    expect(timeAgo(now - 3 * 86_400_000, now)).toBe('3 days ago')
  })
})

describe('people and lists', () => {
  it('makes initials', () => {
    expect(initials('Rohan Kulkarni')).toBe('RK')
    expect(initials('Kabir')).toBe('KA')
    expect(initials('  ')).toBe('?')
  })

  it('gives the same hue to the same id', () => {
    expect(toneFor('abc')).toBe(toneFor('abc'))
  })

  it('groups consecutive items', () => {
    expect(groupBy(['a1', 'a2', 'b1'], (s) => s[0]!).map((g) => [g.key, g.items.length])).toEqual([
      ['a', 2],
      ['b', 1],
    ])
  })
})

describe('category guesses', () => {
  it('guesses from the description', () => {
    expect(guessCategory('Dinner at Thalassa')).toBe('food')
    expect(guessCategory('Airport cab')).toBe('transport')
    expect(guessCategory('Weekend groceries')).toBe('groceries')
    expect(guessCategory('Villa, 3 nights')).toBe('lodging')
    expect(guessCategory('Concert tickets')).toBe('entertainment')
    expect(guessCategory('Something else')).toBeNull()
  })
})

describe('saved preferences', () => {
  it('falls back to the defaults for anything missing or broken', () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS)
    expect(parsePrefs('not json')).toEqual(DEFAULT_PREFS)
    expect(parsePrefs(JSON.stringify({ theme: 'purple', currency: 'XYZ', lastTarget: { kind: 'group' } }))).toEqual(DEFAULT_PREFS)
  })

  it('keeps valid choices', () => {
    const saved = { theme: 'dark', currency: 'USD', haptics: false, reduceMotion: true, lastTarget: { kind: 'group', id: 'g1' } }
    expect(parsePrefs(JSON.stringify(saved))).toEqual(saved)
  })
})
