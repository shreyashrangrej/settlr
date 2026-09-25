import { v, type Infer } from 'convex/values'

import type { Category, Currency } from '../../src/lib/schemas'

// Convex validators for the enums in src/lib/schemas.ts. The type checks
// below fail the build if the two lists drift apart.

export const currency = v.union(
  v.literal('USD'),
  v.literal('EUR'),
  v.literal('GBP'),
  v.literal('INR'),
  v.literal('CAD'),
  v.literal('AUD'),
)

export const category = v.union(
  v.literal('food'),
  v.literal('groceries'),
  v.literal('transport'),
  v.literal('lodging'),
  v.literal('utilities'),
  v.literal('entertainment'),
  v.literal('other'),
)

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
const currenciesMatch: Same<Infer<typeof currency>, Currency> = true
const categoriesMatch: Same<Infer<typeof category>, Category> = true
void currenciesMatch
void categoriesMatch
