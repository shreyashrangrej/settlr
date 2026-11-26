import { v, type Infer } from 'convex/values'

import type { Category, Currency } from '@settlr/shared/schemas'

// Convex validators for the enums in packages/shared/src/schemas.ts. The type checks
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

// A group expense split some other way than equally: what each member owes
// (member id -> cents, adding up to the amount), plus what was typed into
// the form so it can be edited again. See packages/shared/src/split.ts.
export const groupSplit = v.object({
  mode: v.union(
    v.literal('exact'),
    v.literal('percent'),
    v.literal('shares'),
    v.literal('items'),
  ),
  owed: v.record(v.string(), v.number()),
  // Cents for 'exact', basis points for 'percent', counts for 'shares'.
  inputs: v.optional(v.record(v.string(), v.number())),
  // An itemised bill: its lines, and tax/tip spread over them.
  items: v.optional(
    v.array(
      v.object({ name: v.string(), amountCents: v.number(), memberIds: v.array(v.string()) }),
    ),
  ),
  extraCents: v.optional(v.number()),
})
export type GroupSplit = Infer<typeof groupSplit>

// Paid in another currency and converted into the group's: the amount as
// paid, and the rate used (group currency per unit of `currency`).
export const original = v.object({ amountCents: v.number(), currency, rate: v.number() })

export const tags = v.optional(v.array(v.string()))

export const frequency = v.union(
  v.literal('weekly'),
  v.literal('monthly'),
  v.literal('yearly'),
)

// What a form sends for an unequal split; the server works out `owed`.
export const groupSplitInput = v.object({
  mode: v.union(
    v.literal('exact'),
    v.literal('percent'),
    v.literal('shares'),
    v.literal('items'),
  ),
  inputs: v.optional(v.record(v.string(), v.number())),
  items: v.optional(
    v.array(
      v.object({ name: v.string(), amountCents: v.number(), memberIds: v.array(v.string()) }),
    ),
  ),
  extraCents: v.optional(v.number()),
})
export type GroupSplitInput = Infer<typeof groupSplitInput>
