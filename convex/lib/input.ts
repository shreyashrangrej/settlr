import { ConvexError } from 'convex/values'

// Argument validators only check types. These check the values, with the
// same limits as the zod schemas the forms use (src/lib/schemas.ts), since
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
  if (!Number.isInteger(cents) || cents <= 0 || cents > 100_000_000) {
    throw new ConvexError('Enter an amount greater than zero.')
  }
  return cents
}

export function isoDate(date: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date
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
