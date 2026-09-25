import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

import { category, currency } from './lib/validators'

// Every row belongs to one signed-in user (`userId` is their Convex
// `tokenIdentifier`). Friends and group members are people the owner tracks
// by name; they don't need a Settlr account. They can be linked to one:
//
// - A friend request (by email) that's accepted links two friend rows, one
//   per person (`linkedUserId`, `counterpartId`). Their one-on-one ledger is
//   then kept in both: every entry is mirrored into the other row from that
//   person's side (`mirrorId` pairs them), so each user still only reads
//   their own rows.
// - A group member can be linked to a Settlr user (`members[].userId`); the
//   `groupMembers` table indexes which groups each linked user is in.
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
    // Set once a friend request is accepted: the friend's user id and their
    // row for you.
    linkedUserId: v.optional(v.string()),
    counterpartId: v.optional(v.id('friends')),
    // The friend request sent from this row, if it hasn't been accepted.
    request: v.optional(v.union(v.literal('pending'), v.literal('declined'))),
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
        // The same entry in the linked friend's ledger.
        mirrorId: v.optional(v.id('friendEntries')),
        // Shared with the twin: both entries point at the same receipt.
        receiptId: v.optional(v.id('receipts')),
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
        mirrorId: v.optional(v.id('friendEntries')),
      }),
    ),
  )
    .index('by_friendId_and_date', ['friendId', 'date'])
    .index('by_userId_and_date', ['userId', 'date']),

  // Sent from a friend row that has an email. Matched to the recipient by
  // email, so it waits for them even if they haven't signed up yet.
  friendRequests: defineTable({
    fromUserId: v.string(),
    fromName: v.string(),
    fromEmail: v.string(),
    fromFriendId: v.id('friends'),
    toEmail: v.string(),
    status: v.union(v.literal('pending'), v.literal('accepted'), v.literal('declined')),
  })
    .index('by_toEmail_and_status', ['toEmail', 'status'])
    .index('by_fromFriendId', ['fromFriendId']),

  // Things that happened to you: someone split an expense with you, recorded
  // a payment, or accepted your friend request. Amounts are from your side.
  notifications: defineTable({
    userId: v.string(),
    kind: v.union(
      v.literal('friend_expense'),
      v.literal('friend_payment'),
      v.literal('group_expense'),
      v.literal('group_added'),
      v.literal('request_accepted'),
      // Someone edited an expense or payment you share. Amounts are the
      // edited entry's effect on you.
      v.literal('friend_entry_updated'),
      v.literal('group_expense_updated'),
    ),
    actorName: v.string(),
    description: v.optional(v.string()),
    // Your share of an expense, or the payment amount.
    amountCents: v.optional(v.number()),
    currency: v.optional(currency),
    friendId: v.optional(v.id('friends')),
    groupId: v.optional(v.id('groups')),
    groupName: v.optional(v.string()),
    read: v.boolean(),
  })
    .index('by_userId', ['userId'])
    .index('by_userId_and_read', ['userId', 'read']),

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
        // The Settlr user this member is, if linked.
        userId: v.optional(v.string()),
      }),
    ),
    // The owner's member.
    meMemberId: v.string(),
    expenseCount: v.number(),
    totalCents: v.number(),
    byCategory: v.record(v.string(), v.number()),
    // 'YYYY-MM' -> cents.
    byMonth: v.record(v.string(), v.number()),
    lastExpenseAt: v.optional(v.number()),
  }).index('by_userId', ['userId']),

  // Linked (non-owner) members, so they can find the groups they're in.
  groupMembers: defineTable({
    groupId: v.id('groups'),
    userId: v.string(),
  })
    .index('by_userId', ['userId'])
    .index('by_groupId', ['groupId']),

  groupExpenses: defineTable({
    groupId: v.id('groups'),
    description: v.string(),
    amountCents: v.number(),
    paidBy: v.string(),
    splitAmong: v.array(v.string()),
    category,
    date: v.string(),
    receiptId: v.optional(v.id('receipts')),
  })
    .index('by_groupId_and_date', ['groupId', 'date'])
    .index('by_groupId_and_amountCents', ['groupId', 'amountCents'])
    .searchIndex('search_description', {
      searchField: 'description',
      filterFields: ['groupId', 'category', 'paidBy'],
    }),

  // A receipt (an image or a PDF in Convex file storage) uploaded by
  // `userId`. It starts unattached; adding or editing an expense attaches
  // it, after which it belongs to that expense (and is deleted with it).
  // Unattached receipts are deleted a day after upload.
  receipts: defineTable({
    userId: v.string(),
    storageId: v.id('_storage'),
    fileName: v.string(),
    contentType: v.string(),
    size: v.number(),
    attached: v.boolean(),
  }).index('by_storageId', ['storageId']),

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
    receiptId: v.optional(v.id('receipts')),
  }).index('by_userId_and_date', ['userId', 'date']),
})
