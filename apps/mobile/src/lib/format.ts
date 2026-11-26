import { formatMoney, formatWholeMoney } from '@settlr/shared/format'
import type { Currency } from '@settlr/shared/schemas'

import type { Hue } from '@/theme/tokens'

// Formatting for the phone. Unlike the web's server-rendered pages there is
// no hydration to keep stable, so "today" is the phone's own date.

/** "₹6,200" for whole amounts, "$42.50" otherwise. Always positive. */
export function money(cents: number, currency: Currency) {
  const abs = Math.abs(cents)
  return abs % 100 === 0 ? formatWholeMoney(abs, currency) : formatMoney(abs, currency)
}

/** With a sign: "+₹1,500", "−₹890", "₹0". */
export function signedMoney(cents: number, currency: Currency) {
  return (cents > 0 ? '+' : cents < 0 ? '−' : '') + money(cents, currency)
}

const SYMBOLS: Record<Currency, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
  CAD: 'C$',
  AUD: 'A$',
}

export function currencySymbol(currency: Currency) {
  return SYMBOLS[currency]
}

/** Two letters for an avatar: "Rohan Kulkarni" → "RK", "Kabir" → "KA". */
export function initials(name: string, fallback = '?') {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return fallback
  const letters =
    words.length > 1 ? words[0]![0]! + words[words.length - 1]![0]! : words[0]!.slice(0, 2)
  return letters.toUpperCase()
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? ''
}

const TONES: Array<Hue> = ['blue', 'rose', 'orange', 'teal', 'green', 'amber', 'violet', 'red']

/** A stable label hue for a person or group, from its id. */
export function toneFor(key: string): Hue {
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0
  return TONES[Math.abs(hash) % TONES.length]!
}

/** The phone's local date as `YYYY-MM-DD`. */
export function localIsoDate(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function parts(iso: string) {
  const date = new Date(`${iso}T00:00:00Z`)
  return {
    weekday: WEEKDAYS[date.getUTCDay()]!,
    day: date.getUTCDate(),
    month: MONTHS[date.getUTCMonth()]!,
    year: date.getUTCFullYear(),
  }
}

/** "Thursday, 26 November". */
export function longDate(iso: string) {
  const p = parts(iso)
  return `${p.weekday}, ${p.day} ${p.month}`
}

/** "26 Nov", or "26 Nov 2025" outside `today`'s year. */
export function shortDate(iso: string, today: string) {
  const p = parts(iso)
  const year = p.year === parts(today).year ? '' : ` ${p.year}`
  return `${p.day} ${p.month.slice(0, 3)}${year}`
}

/** A day heading in a list: Today, Yesterday, "Wednesday, 25 Nov". */
export function dayHeading(iso: string, today: string) {
  if (iso === today) return 'Today'
  if (iso === addDays(today, -1)) return 'Yesterday'
  const p = parts(iso)
  const year = p.year === parts(today).year ? '' : ` ${p.year}`
  return `${p.weekday}, ${p.day} ${p.month.slice(0, 3)}${year}`
}

/** A chip label for a date: Today, Yesterday, or "Mon, 23 Nov". */
export function dateChip(iso: string, today: string) {
  if (iso === today) return 'Today'
  if (iso === addDays(today, -1)) return 'Yesterday'
  const p = parts(iso)
  return `${p.weekday.slice(0, 3)}, ${p.day} ${p.month.slice(0, 3)}`
}

/** "November", or "November 2025" outside `today`'s year. */
export function monthName(month: string, today: string) {
  const p = parts(`${month}-01`)
  return p.year === parts(today).year ? p.month : `${p.month} ${p.year}`
}

/** "Morning", "Afternoon" or "Evening" for the phone's clock. */
export function partOfDay(date = new Date()) {
  const hour = date.getHours()
  return hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening'
}

/** "20 min ago", "2 hours ago", "Wed", "18 Nov" for a timestamp. */
export function timeAgo(ms: number, now = Date.now()) {
  const minutes = Math.round((now - ms) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  const date = new Date(ms)
  return `${date.getDate()} ${MONTHS[date.getMonth()]!.slice(0, 3)}`
}

/** Groups items by a key in order of first appearance. */
export function groupBy<T>(items: Array<T>, key: (item: T) => string) {
  const out: Array<{ key: string; items: Array<T> }> = []
  for (const item of items) {
    const k = key(item)
    const last = out[out.length - 1]
    if (last && last.key === k) last.items.push(item)
    else out.push({ key: k, items: [item] })
  }
  return out
}
