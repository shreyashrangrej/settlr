import type { Category } from '@settlr/shared/schemas'

import type { Hue } from '@/theme/tokens'

/** Each category's label hue (System board: Label hues). */
export const CATEGORY_HUE: Record<Category, Hue> = {
  food: 'orange',
  groceries: 'green',
  transport: 'blue',
  lodging: 'violet',
  utilities: 'amber',
  entertainment: 'rose',
  other: 'gray',
}

// Words that give a category away, for the ✨ guess on Add expense. The
// first category with a match wins; anything else stays as picked.
const HINTS: Array<[Category, RegExp]> = [
  [
    'groceries',
    /\b(grocer\w*|supermarket|vegetables?|veggies|fruits?|milk|bigbasket|blinkit|zepto|dmart|instamart)\b/i,
  ],
  [
    'food',
    /\b(dinner|lunch|breakfast|brunch|food|chai|tea|coffee|cafe|snacks?|pizza|biryani|restaurant|meal|drinks?|beer|bar|swiggy|zomato|dessert|samosa|burger)\b/i,
  ],
  [
    'transport',
    /\b(cab|taxi|uber|ola|auto|metro|bus|train|flight|fuel|petrol|diesel|parking|toll|scooter|bike|rapido|airport)\b/i,
  ],
  ['lodging', /\b(hotel|villa|airbnb|hostel|stay|rent|room|lodge|resort)\b/i],
  [
    'utilities',
    /\b(electricity|power|water|gas|wifi|internet|broadband|phone|mobile|recharge|bill|maintenance)\b/i,
  ],
  [
    'entertainment',
    /\b(movie|cinema|concert|tickets?|show|netflix|spotify|game|games|party|club|parasailing|museum|streaming)\b/i,
  ],
]

/** A category the description suggests, or null. */
export function guessCategory(description: string): Category | null {
  for (const [category, pattern] of HINTS) if (pattern.test(description)) return category
  return null
}
