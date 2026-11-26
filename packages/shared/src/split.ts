// Split math shared by the forms (live previews) and Convex (which re-checks
// every split it stores). Everything is integer cents; leftover cents are
// handed out in member order so the shares always add up to the total.

export const SPLIT_MODES = ['equal', 'exact', 'percent', 'shares', 'items'] as const
export type SplitMode = (typeof SPLIT_MODES)[number]

// Each line of an itemised bill: what it cost and who had it.
export type SplitItem = { name: string; amountCents: number; memberIds: Array<string> }

export const MAX_ITEMS = 50

/**
 * Splits `total` in proportion to `weights` (member id -> weight, in member
 * order), largest remainder first, ties to the earlier member. Members with
 * no weight get nothing.
 */
export function proportional(
  total: number,
  weights: Array<[string, number]>,
): Map<string, number> {
  const result = new Map<string, number>()
  const sum = weights.reduce((acc, [, w]) => acc + Math.max(0, w), 0)
  if (sum <= 0 || total <= 0) return result
  const raw = weights.map(([id, w], index) => {
    const exact = (total * Math.max(0, w)) / sum
    return { id, index, floor: Math.floor(exact), frac: exact - Math.floor(exact) }
  })
  let left = total - raw.reduce((acc, r) => acc + r.floor, 0)
  const byFrac = [...raw].sort((a, b) => b.frac - a.frac || a.index - b.index)
  for (const r of byFrac) {
    if (left <= 0) break
    if (r.frac > 0 || weights[r.index][1] > 0) {
      r.floor += 1
      left -= 1
    }
  }
  for (const r of raw) if (r.floor > 0) result.set(r.id, r.floor)
  return result
}

/** Equal shares between `memberIds` (sorted into `order`). */
export function equalSplit(total: number, memberIds: Array<string>, order: Array<string>) {
  const participants = order.filter((id) => memberIds.includes(id))
  return proportional(
    total,
    participants.map((id) => [id, 1]),
  )
}

/**
 * Who owes what for an itemised bill: each item is split equally between
 * the people who had it, and `extraCents` (tax, tip, service; negative for
 * a discount) is spread in proportion to those subtotals.
 */
export function itemisedSplit(
  items: Array<SplitItem>,
  extraCents: number,
  order: Array<string>,
) {
  const subtotal = new Map<string, number>()
  for (const item of items) {
    for (const [id, cents] of equalSplit(item.amountCents, item.memberIds, order)) {
      subtotal.set(id, (subtotal.get(id) ?? 0) + cents)
    }
  }
  const weights = order
    .filter((id) => subtotal.has(id))
    .map((id): [string, number] => [id, subtotal.get(id)!])
  const itemsTotal = items.reduce((acc, item) => acc + item.amountCents, 0)
  const total = itemsTotal + extraCents
  return proportional(total, weights)
}

/**
 * The cents each member owes for a split typed into the form. `inputs` is
 * member id -> what was typed: cents for 'exact', basis points (1% = 100)
 * for 'percent', a count for 'shares'.
 */
export function computeSplit(
  mode: Exclude<SplitMode, 'equal' | 'items'>,
  total: number,
  inputs: Record<string, number>,
  order: Array<string>,
): Map<string, number> {
  if (mode === 'exact') {
    return new Map(
      order.filter((id) => (inputs[id] ?? 0) > 0).map((id) => [id, inputs[id]]),
    )
  }
  if (mode === 'percent') {
    // Until they add up to 100%, show each percentage of the total as is
    // (not scaled up to fill it); `splitProblem` reports the gap.
    const bps = order.reduce((acc, id) => acc + (inputs[id] ?? 0), 0)
    if (bps !== 10_000) {
      return new Map(
        order
          .filter((id) => (inputs[id] ?? 0) > 0)
          .map((id) => [id, Math.floor((total * inputs[id]) / 10_000)]),
      )
    }
  }
  return proportional(
    total,
    order.filter((id) => (inputs[id] ?? 0) > 0).map((id) => [id, inputs[id]]),
  )
}

/** What's wrong with a split, or null when it adds up. */
export function splitProblem(
  mode: SplitMode,
  total: number,
  inputs: Record<string, number>,
  owed: Map<string, number>,
) {
  if (owed.size === 0) return 'Split it with at least one person.'
  if (mode === 'percent') {
    const bps = Object.values(inputs).reduce((a, b) => a + b, 0)
    if (bps !== 10_000) return `Percentages add up to ${bps / 100}%, not 100%.`
  }
  const sum = [...owed.values()].reduce((a, b) => a + b, 0)
  if (sum !== total) return 'The shares don’t add up to the total.'
  return null
}
