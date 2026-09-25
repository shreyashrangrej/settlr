import type { Currency } from './schemas'
import type { Member } from './types'

// Formatting used by server-rendered routes. The locale and time zone are
// fixed so server HTML and client hydration always produce identical text.

const moneyFormatters = new Map<string, Intl.NumberFormat>()

export function formatMoney(cents: number, currency: Currency) {
  let formatter = moneyFormatters.get(currency)
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency })
    moneyFormatters.set(currency, formatter)
  }
  return formatter.format(cents / 100)
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

/** Formats a `YYYY-MM-DD` date string. */
export function formatDate(isoDate: string) {
  return dateFormatter.format(new Date(`${isoDate}T00:00:00Z`))
}

export function memberName(members: Array<Member>, id: string) {
  return members.find((m) => m.id === id)?.name ?? 'Former member'
}

/** Parses user input like "12.5" or "1,234.56" into integer cents. */
export function parseAmountToCents(input: string): number | null {
  const normalized = input.replace(/[,\s]/g, '')
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return null
  const [whole, fraction = ''] = normalized.split('.')
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
}

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}
