import { MAX_AMOUNT_CENTS } from '@settlr/shared/schemas'
import { ConvexError } from 'convex/values'

// Argument validators only check types. These check the values, with the
// same limits as the zod schemas the forms use (packages/shared/src/schemas.ts), since
// clients can call public functions directly.

export function text(value: string, label: string, max: number) {
  const trimmed = value.trim()
  if (!trimmed) throw new ConvexError(`${label} can’t be empty.`)
  if (trimmed.length > max) {
    throw new ConvexError(`${label} must be at most ${max} characters.`)
  }
  return trimmed
}

export function optionalText(value: string | undefined, label: string, max: number) {
  const trimmed = value?.trim()
  return trimmed ? text(trimmed, label, max) : undefined
}

// Integer minor units, never floats.
export function amount(cents: number) {
  if (!Number.isInteger(cents) || cents <= 0) {
    throw new ConvexError('Enter an amount greater than zero.')
  }
  if (cents > MAX_AMOUNT_CENTS) throw new ConvexError('Amounts can be at most 1,000,000.00.')
  return cents
}

export function isoDate(date: string) {
  // An impossible date (month 13) is an Invalid Date, whose toISOString throws.
  const parsed = new Date(`${date}T00:00:00Z`)
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    throw new ConvexError('Enter a valid date.')
  }
  return date
}

export function isoMonth(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new ConvexError('Enter a valid month.')
  }
  return month
}

export function email(value: string | undefined) {
  const trimmed = value?.trim().toLowerCase()
  if (!trimmed) return undefined
  if (trimmed.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    throw new ConvexError('Enter a valid email address.')
  }
  return trimmed
}

// How many rows a "show more" list may ask for.
export function listLimit(limit: number) {
  return Math.min(Math.max(Math.floor(limit), 1), 500)
}

// Free-form labels on an expense: up to 5, each up to 24 characters,
// lowercased and without duplicates.
export function tags(values: Array<string> | undefined) {
  if (!values) return undefined
  const cleaned = [
    ...new Set(
      values
        .map((t) => t.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-'))
        .filter(Boolean),
    ),
  ]
  if (cleaned.length > 5) throw new ConvexError('Use at most 5 tags.')
  for (const tag of cleaned) {
    if (tag.length > 24) throw new ConvexError('Keep each tag under 24 characters.')
  }
  return cleaned.length ? cleaned : undefined
}

// A UPI virtual payment address: name@bank.
export function upiId(value: string | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  if (!/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9.\-]{1,64}$/.test(trimmed)) {
    throw new ConvexError('Enter a UPI id like name@bank.')
  }
  return trimmed
}
