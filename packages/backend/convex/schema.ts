import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

import {
  category,
  currency,
  frequency,
  groupSplit,
  original,
  tags,
} from './lib/validators'

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
    // Their UPI id (name@bank), for "Pay with UPI" when they aren't linked.
    upiId: v.optional(v.string()),
    // When you last sent them a payment reminder.
    lastRemindedAt: v.optional(v.number()),
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
        // 'exact': the other person owes `owedCents`.
        split: v.union(v.literal('equal'), v.literal('full'), v.literal('exact')),
        owedCents: v.optional(v.number()),
        tags,
        recurringId: v.optional(v.id('recurring')),
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
        // Recorded by the other person in a linked friendship and not yet
        // confirmed by whoever received the money. Balances already count it;
        // rejecting it deletes it.
        unconfirmed: v.optional(v.boolean()),
        // The Settlr user who recorded it.
        recordedBy: v.optional(v.string()),
      }),
    ),
  )
    .index('by_friendId_and_date', ['friendId', 'date'])
    .index('by_friendId_and_amountCents', ['friendId', 'amountCents'])
    .index('by_userId_and_date', ['userId', 'date'])
    // Only expenses have a description, so a text search finds no payments.
    .searchIndex('search_description', {
      searchField: 'description',
      filterFields: ['friendId', 'category', 'paidBy'],
    }),

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
      // A settle-up payment between two group members. `description` says
      // who paid whom from your side ("Priya paid you"), `amountCents` is
      // the amount.
      v.literal('group_payment'),
      // Someone reminded you that you owe them (`amountCents`).
      v.literal('reminder'),
      // Your payment was confirmed or rejected by whoever received it.
      v.literal('payment_confirmed'),
      v.literal('payment_rejected'),
      // Someone commented on a group expense (`description` is the comment).
      v.literal('comment'),
      // Someone joined your group through its invite link.
      v.literal('group_joined'),
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
        // Settle-up payments: what this member paid other members minus
        // what they were paid. Absent until their first payment.
        settledCents: v.optional(v.number()),
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
    // Hidden from the active list (and dashboard totals) once settled up.
    archived: v.optional(v.boolean()),
    // Secret tokens for the join link and the read-only share page; absent
    // while the link is off.
    inviteToken: v.optional(v.string()),
    shareToken: v.optional(v.string()),
    // A spending budget for the whole group (a trip budget), in its currency.
    budgetCents: v.optional(v.number()),
  })
    .index('by_userId', ['userId'])
    .index('by_inviteToken', ['inviteToken'])
    .index('by_shareToken', ['shareToken']),

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
    // Absent: split equally between `splitAmong`. Otherwise who owes what
    // (`splitAmong` is then everyone with a share).
    split: v.optional(groupSplit),
    original: v.optional(original),
    tags,
    recurringId: v.optional(v.id('recurring')),
  })
    .index('by_groupId_and_date', ['groupId', 'date'])
    .index('by_groupId_and_amountCents', ['groupId', 'amountCents'])
    .searchIndex('search_description', {
      searchField: 'description',
      filterFields: ['groupId', 'category', 'paidBy'],
    }),

  // A settle-up payment between two members of a group. It changes their
  // `settledCents`, not what anyone paid or owes for expenses, so group
  // spending totals and insights leave it out.
  groupPayments: defineTable({
    groupId: v.id('groups'),
    // Member ids: who handed the money over, and who got it.
    from: v.string(),
    to: v.string(),
    amountCents: v.number(),
    date: v.string(),
    // Who recorded it, and whether the recipient still has to confirm it
    // (only asked of a linked recipient who didn't record it themselves).
    recordedBy: v.optional(v.string()),
    unconfirmed: v.optional(v.boolean()),
  }).index('by_groupId_and_date', ['groupId', 'date']),

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
    // Optional limits per category (category -> cents) within the budget.
    byCategory: v.optional(v.record(v.string(), v.number())),
  }).index('by_userId_and_currency', ['userId', 'currency']),

  personalExpenses: defineTable({
    userId: v.string(),
    description: v.string(),
    amountCents: v.number(),
    currency,
    category,
    date: v.string(),
    receiptId: v.optional(v.id('receipts')),
    tags,
    recurringId: v.optional(v.id('recurring')),
  }).index('by_userId_and_date', ['userId', 'date']),

  // Per-user settings that other people (or the server) need, unlike the
  // browser-only preferences: UPI id, the weekly digest, the email inbox.
  profiles: defineTable({
    userId: v.string(),
    name: v.string(),
    email: v.string(),
    upiId: v.optional(v.string()),
    weeklyDigest: v.optional(v.boolean()),
    // Forwarding address token: <inboxToken>@INBOUND_EMAIL_DOMAIN.
    inboxToken: v.optional(v.string()),
  })
    .index('by_userId', ['userId'])
    .index('by_inboxToken', ['inboxToken'])
    .index('by_weeklyDigest', ['weeklyDigest']),

  // What happened in a group, newest last: expenses added, edited and
  // deleted, payments, members joining. Written in the same mutation.
  activity: defineTable({
    groupId: v.id('groups'),
    actorName: v.string(),
    kind: v.union(
      v.literal('expense_added'),
      v.literal('expense_updated'),
      v.literal('expense_deleted'),
      v.literal('expense_restored'),
      v.literal('payment_added'),
      v.literal('payment_deleted'),
      v.literal('payment_confirmed'),
      v.literal('member_joined'),
      v.literal('comment'),
      v.literal('group_updated'),
    ),
    description: v.string(),
    amountCents: v.optional(v.number()),
    expenseId: v.optional(v.id('groupExpenses')),
  }).index('by_groupId', ['groupId']),

  // Comments on a group expense, oldest first.
  comments: defineTable({
    groupId: v.id('groups'),
    expenseId: v.id('groupExpenses'),
    userId: v.string(),
    name: v.string(),
    body: v.string(),
  }).index('by_expenseId', ['expenseId']),

  // Deleted expenses, kept for 30 days so they can be restored (the toast's
  // Undo, or the Trash page). Their receipts stay until the row is purged.
  trash: defineTable({
    userId: v.string(),
    description: v.string(),
    amountCents: v.number(),
    currency,
    where: v.optional(v.string()),
    item: v.union(
      v.object({
        kind: v.literal('personal'),
        expense: v.object({
          description: v.string(),
          amountCents: v.number(),
          currency,
          category,
          date: v.string(),
          receiptId: v.optional(v.id('receipts')),
          tags,
          recurringId: v.optional(v.id('recurring')),
        }),
      }),
      v.object({
        kind: v.literal('group'),
        groupId: v.id('groups'),
        expense: v.object({
          description: v.string(),
          amountCents: v.number(),
          paidBy: v.string(),
          splitAmong: v.array(v.string()),
          category,
          date: v.string(),
          receiptId: v.optional(v.id('receipts')),
          split: v.optional(groupSplit),
          original: v.optional(original),
          tags,
          recurringId: v.optional(v.id('recurring')),
        }),
      }),
      v.object({
        kind: v.literal('friend'),
        friendId: v.id('friends'),
        expense: v.object({
          description: v.string(),
          amountCents: v.number(),
          currency,
          category,
          paidBy: v.union(v.literal('me'), v.literal('friend')),
          split: v.union(v.literal('equal'), v.literal('full'), v.literal('exact')),
          owedCents: v.optional(v.number()),
          date: v.string(),
          receiptId: v.optional(v.id('receipts')),
          tags,
          recurringId: v.optional(v.id('recurring')),
        }),
      }),
    ),
  }).index('by_userId', ['userId']),

  // Expenses that repeat (rent, subscriptions). A daily cron adds each one
  // on `nextDate` as `userId`, then moves `nextDate` on.
  recurring: defineTable({
    userId: v.string(),
    userName: v.string(),
    kind: v.union(v.literal('personal'), v.literal('friend'), v.literal('group')),
    friendId: v.optional(v.id('friends')),
    groupId: v.optional(v.id('groups')),
    description: v.string(),
    amountCents: v.number(),
    currency,
    category,
    // Friend: 'me' | 'friend'. Group: a member id.
    paidBy: v.optional(v.string()),
    split: v.optional(v.union(v.literal('equal'), v.literal('full'))),
    splitAmong: v.optional(v.array(v.string())),
    frequency,
    // The day of the month it was set up on, so a 31st survives February.
    anchorDay: v.number(),
    nextDate: v.string(),
    paused: v.boolean(),
  })
    .index('by_userId', ['userId'])
    .index('by_paused_and_nextDate', ['paused', 'nextDate']),

  // Saved assistant conversations.
  assistantChats: defineTable({
    userId: v.string(),
    title: v.string(),
    updatedAt: v.number(),
  }).index('by_userId_and_updatedAt', ['userId', 'updatedAt']),

  assistantMessages: defineTable({
    chatId: v.id('assistantChats'),
    role: v.union(v.literal('user'), v.literal('assistant')),
    content: v.string(),
    memo: v.optional(v.string()),
    // The cards shown under an assistant reply (ChatEvent[] as JSON).
    events: v.optional(v.string()),
  }).index('by_chatId', ['chatId']),

  // Emails forwarded to your inbox address, read into draft expenses for
  // you to add or dismiss.
  inboxItems: defineTable({
    userId: v.string(),
    from: v.string(),
    subject: v.string(),
    snippet: v.string(),
    status: v.union(v.literal('new'), v.literal('added'), v.literal('dismissed')),
    draft: v.optional(
      v.object({
        description: v.string(),
        amountCents: v.optional(v.number()),
        currency: v.optional(currency),
        category: v.optional(category),
        date: v.optional(v.string()),
      }),
    ),
  }).index('by_userId_and_status', ['userId', 'status']),

  // Caps on things that cost money or reach other people's inboxes (see
  // usage.ts): how often `key` ("ai:<userId>", "signin:<email>", ...) was
  // used in the window that started at `windowStart`. One row per key.
  usage: defineTable({
    key: v.string(),
    windowStart: v.number(),
    count: v.number(),
  }).index('by_key', ['key']),
})
