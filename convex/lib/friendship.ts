import { ConvexError } from 'convex/values'

import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { addToBalance, friendDelta } from './ledger'

// Linked friends keep one ledger each, mirrored: every entry in one has a
// twin in the other, written from that person's side (who paid is swapped).

type Entry = Doc<'friendEntries'>
// An entry without system fields. Distributes over the expense/payment
// union (plain Omit would merge them into one type).
export type NewEntry = Entry extends infer T
  ? T extends Entry
    ? Omit<T, '_id' | '_creationTime'>
    : never
  : never

// Most history copied when two friends link. Past this, linking asks the
// people to start fresh instead of running out of transaction budget.
export const MAX_LINK_HISTORY = 1000

/** The entry as the other person sees it. */
export function flip(entry: NewEntry | Entry, counterpart: Doc<'friends'>): NewEntry {
  const { _id, _creationTime, ...fields } = entry as Entry
  void _id
  void _creationTime
  return {
    ...fields,
    userId: counterpart.userId,
    friendId: counterpart._id,
    paidBy: entry.paidBy === 'me' ? 'friend' : 'me',
  } as NewEntry
}

/**
 * Writes `entry`'s twin into the counterpart's ledger and links the two.
 * Doesn't touch balances; callers update or recompute them.
 */
export async function mirrorEntry(
  ctx: MutationCtx,
  entryId: Id<'friendEntries'>,
  entry: NewEntry | Entry,
  counterpart: Doc<'friends'>,
) {
  const twin = flip(entry, counterpart)
  const twinId = await ctx.db.insert('friendEntries', { ...twin, mirrorId: entryId })
  await ctx.db.patch('friendEntries', entryId, { mirrorId: twinId })
  return { twinId, twin }
}

/** The friend's row for you, if the two of you are linked. */
export async function linkedCounterpart(ctx: MutationCtx, friend: Doc<'friends'>) {
  if (!friend.counterpartId) return null
  const counterpart = await ctx.db.get('friends', friend.counterpartId)
  // Both sides must still point at each other.
  return counterpart && counterpart.counterpartId === friend._id ? counterpart : null
}

/** All of a friend's entries, up to the link limit. */
export async function ledgerOf(ctx: MutationCtx, friendId: Id<'friends'>) {
  const entries = await ctx.db
    .query('friendEntries')
    .withIndex('by_friendId_and_date', (q) => q.eq('friendId', friendId))
    .take(MAX_LINK_HISTORY + 1)
  if (entries.length > MAX_LINK_HISTORY) {
    throw new ConvexError(
      'This friendship has too much history to link. Remove the friend and add them again to start fresh.',
    )
  }
  return entries
}

/** Sets a friend's balances from their whole ledger. */
export async function recomputeBalances(ctx: MutationCtx, friendId: Id<'friends'>) {
  let balances: Record<string, number> = {}
  for (const entry of await ledgerOf(ctx, friendId)) {
    balances = addToBalance(balances, entry.currency, friendDelta(entry))
  }
  await ctx.db.patch('friends', friendId, { balances })
}
