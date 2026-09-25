import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

import { category, currency } from './lib/validators'

// Every row belongs to one signed-in user (`userId` is their Convex
// `tokenIdentifier`). Friends and group members are people the owner tracks
// by name; they don't need a Settlr account.
//
// Totals that pages show on every load (friend balances, group member
// totals, group insights) are kept on the parent document and updated in the
// same mutation as each expense or payment, so reads never scan a whole
// ledger. `convex/lib/ledger.ts` owns that math.
export default defineSchema({
  friends: defineTable({
    userId: v.string(),
    name: v.string(),
    email: v.optional(v.string()),
    // Currency code -> cents. Positive: the friend owes you.
    balances: v.record(v.string(), v.number()),
    lastActivityAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_userId_and_lastActivityAt', ['userId', 'lastActivityAt']),

  // One-on-one ledger with a friend: shared expenses and settle-up payments.
  friendEntries: defineTable(
    v.union(
      v.object({
        kind: v.literal('expense'),
        userId: v.string(),
        friendId: v.id('friends'),
        description: v.string(),
        amountCents: v.number(),
        currency,
        category,
        paidBy: v.union(v.literal('me'), v.literal('friend')),
        // 'equal': each owes half. 'full': the other person owes all of it.
        split: v.union(v.literal('equal'), v.literal('full')),
        date: v.string(),
      }),
      v.object({
        kind: v.literal('payment'),
        userId: v.string(),
        friendId: v.id('friends'),
        amountCents: v.number(),
        currency,
        // Who handed the money over.
        paidBy: v.union(v.literal('me'), v.literal('friend')),
        note: v.optional(v.string()),
        date: v.string(),
      }),
    ),
  ).index('by_friendId_and_date', ['friendId', 'date']),

  groups: defineTable({
    userId: v.string(),
    name: v.string(),
    currency,
    // At most 20, so an array is fine. One of them is the owner.
    members: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        paidCents: v.number(),
        owedCents: v.number(),
      }),
    ),
    meMemberId: v.string(),
    expenseCount: v.number(),
    totalCents: v.number(),
    byCategory: v.record(v.string(), v.number()),
    // 'YYYY-MM' -> cents.
    byMonth: v.record(v.string(), v.number()),
    lastExpenseAt: v.optional(v.number()),
  }).index('by_userId', ['userId']),

  groupExpenses: defineTable({
    groupId: v.id('groups'),
    description: v.string(),
    amountCents: v.number(),
    paidBy: v.string(),
    splitAmong: v.array(v.string()),
    category,
    date: v.string(),
  })
    .index('by_groupId_and_date', ['groupId', 'date'])
    .index('by_groupId_and_amountCents', ['groupId', 'amountCents'])
    .searchIndex('search_description', {
      searchField: 'description',
      filterFields: ['groupId', 'category', 'paidBy'],
    }),

  // Monthly budget for your personal spending, one per currency. It applies
  // to every month.
  budgets: defineTable({
    userId: v.string(),
    currency,
    amountCents: v.number(),
  }).index('by_userId_and_currency', ['userId', 'currency']),

  personalExpenses: defineTable({
    userId: v.string(),
    description: v.string(),
    amountCents: v.number(),
    currency,
    category,
    date: v.string(),
  }).index('by_userId_and_date', ['userId', 'date']),
})
