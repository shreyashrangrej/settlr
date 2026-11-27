import { parseAmountToCents } from '@settlr/shared/format'
import { MAX_AMOUNT_CENTS } from '@settlr/shared/schemas'

// The amount typed on Add expense's keypad, kept as the string shown
// ("1240.5"), never a float. Every currency has two decimals.

export type Key = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'del'

export function pressKey(amount: string, key: Key): string {
  if (key === 'del') return amount.slice(0, -1)
  if (key === '.') {
    if (amount.includes('.')) return amount
    return (amount || '0') + '.'
  }
  const [whole = '', fraction] = amount.split('.')
  if (fraction !== undefined && fraction.length >= 2) return amount
  if (whole === '0' && fraction === undefined) return key
  const next = amount + key
  return amountCents(next) > MAX_AMOUNT_CENTS ? amount : next
}

/** What's typed in an amount field, kept to digits and one kind of point. */
export function cleanAmount(text: string) {
  // Keyboards in many languages type "12,50"; read that comma as the point.
  return text.replace(',', '.').replace(/[^0-9.]/g, '')
}

/** The amount in cents, or 0 while it's empty or just "0.". */
export function amountCents(amount: string) {
  if (!amount) return 0
  return parseAmountToCents(amount.endsWith('.') ? amount.slice(0, -1) : amount) ?? 0
}

/** The typed amount with grouping for display: "12,400.5". INR groups the Indian way. */
export function displayAmount(amount: string, indian: boolean) {
  if (!amount) return '0'
  const [whole = '0', fraction] = amount.split('.')
  const grouped = Number(whole).toLocaleString(indian ? 'en-IN' : 'en-US')
  return fraction === undefined ? grouped : `${grouped}.${fraction}`
}

/** Cents back to keypad text: 124050 → "1240.5", 6200 → "62". */
export function centsToAmount(cents: number) {
  const whole = Math.floor(cents / 100)
  const fraction = cents % 100
  if (fraction === 0) return String(whole)
  return `${whole}.${String(fraction).padStart(2, '0').replace(/0$/, '')}`
}
