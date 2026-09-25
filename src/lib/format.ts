import type { Currency } from './schemas'

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

/** Every non-zero currency in a balance, e.g. "$12.00 + €4.50". */
export function formatBalances(
  balances: Partial<Record<string, number>>,
  { absolute = false } = {},
) {
  return Object.entries(balances)
    .filter(([, cents]) => cents)
    .map(([currency, cents]) =>
      formatMoney(absolute ? Math.abs(cents ?? 0) : (cents ?? 0), currency as Currency),
    )
    .join(' + ')
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

const monthFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

/** Formats a `YYYY-MM` month string, e.g. "September 2026". */
export function formatMonth(month: string) {
  return monthFormatter.format(new Date(`${month}-01T00:00:00Z`))
}

/** The `YYYY-MM` month `delta` months after `month`. */
export function shiftMonth(month: string, delta: number) {
  const [year, m] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, m - 1 + delta, 1))
  return date.toISOString().slice(0, 7)
}

/** The current month in UTC. Call it in loaders, not while rendering. */
export function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

export function categoryLabel(category: string) {
  return category.charAt(0).toUpperCase() + category.slice(1)
}

export function memberName(members: Array<{ id: string; name: string }>, id: string) {
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
