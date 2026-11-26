import { ConvexError, v } from 'convex/values'

import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server'
import { requireUser } from './lib/auth'
import * as input from './lib/input'
import {
  applyGroupExpense,
  applyGroupPayment,
  memberNet,
  settleUp,
  shares,
} from './lib/ledger'
import { logActivity } from './lib/activity'
import { resolveSplit } from './lib/groupSplit'
import { notify } from './lib/notify'
import { upiIds } from './lib/profile'
import { attachReceipt, deleteReceipt } from './lib/receipts'
import { newToken } from './lib/tokens'
import { category, currency, groupSplitInput, original } from './lib/validators'

export const MAX_GROUPS = 200
export const MAX_MEMBERS = 20

type Member = Doc<'groups'>['members'][number]
type User = Awaited<ReturnType<typeof requireUser>>

// The Settlr user a member is: linked members have one, and the owner's
// member is the owner.
export function memberUserId(group: Doc<'groups'>, member: Member) {
  return member.userId ?? (member.id === group.meMemberId ? group.userId : undefined)
}

// Which member the viewer is (the owner, or a linked member).
export function viewerMemberId(group: Doc<'groups'>, userId: string) {
  return group.members.find((m) => memberUserId(group, m) === userId)?.id ?? null
}

// A group the caller owns or is a linked member of, or null if the id is
// malformed, missing or not theirs. Taking a string (not v.id) lets pages
// turn bad URLs into a 404.
export async function findGroup(ctx: QueryCtx, userId: string, groupId: string) {
  const id = ctx.db.normalizeId('groups', groupId)
  const group = id ? await ctx.db.get('groups', id) : null
  return group && viewerMemberId(group, userId) !== null ? group : null
}

export async function requireGroup(ctx: QueryCtx, userId: string, groupId: string) {
  const group = await findGroup(ctx, userId, groupId)
  if (!group) throw new ConvexError('That group doesn’t exist.')
  return group
}

// Only the owner can edit or delete a group.
async function requireOwnedGroup(ctx: QueryCtx, userId: string, groupId: string) {
  const group = await requireGroup(ctx, userId, groupId)
  if (group.userId !== userId) {
    throw new ConvexError('Only the person who created this group can change it.')
  }
  return group
}

function myNet(group: Doc<'groups'>, userId: string) {
  const id = viewerMemberId(group, userId)
  const me = group.members.find((m) => m.id === id)
  return me ? memberNet(me) : 0
}

// Keeps the groupMembers index in step with the linked members.
export async function syncMemberships(ctx: MutationCtx, group: Doc<'groups'>) {
  const wanted = new Set(
    group.members.map((m) => m.userId).filter((id): id is string => Boolean(id)),
  )
  wanted.delete(group.userId)
  const rows = await ctx.db
    .query('groupMembers')
    .withIndex('by_groupId', (q) => q.eq('groupId', group._id))
    .take(MAX_MEMBERS * 2)
  for (const row of rows) {
    if (wanted.has(row.userId)) wanted.delete(row.userId)
    else await ctx.db.delete('groupMembers', row._id)
  }
  for (const userId of wanted) {
    await ctx.db.insert('groupMembers', { groupId: group._id, userId })
  }
  return rows.map((row) => row.userId)
}

// The groups a user owns or is a linked member of, newest first.
export async function myGroups(ctx: QueryCtx, userId: string) {
  const owned = await ctx.db
    .query('groups')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .order('desc')
    .take(MAX_GROUPS)
  const memberships = await ctx.db
    .query('groupMembers')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .take(MAX_GROUPS)
  const joined = await Promise.all(
    memberships.map((m) => ctx.db.get('groups', m.groupId)),
  )
  return [
    ...owned,
    ...joined.filter(
      (g): g is Doc<'groups'> => g !== null && viewerMemberId(g, userId) !== null,
    ),
  ].sort((a, b) => b._creationTime - a._creationTime)
}

/** The caller's groups, newest first, with where they stand in each. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireUser(ctx)
    const groups = await myGroups(ctx, userId)
    return groups.map((group) => ({
      id: group._id,
      name: group.name,
      currency: group.currency,
      memberCount: group.members.length,
      expenseCount: group.expenseCount,
      totalCents: group.totalCents,
      myNetCents: myNet(group, userId),
      isOwner: group.userId === userId,
      archived: group.archived ?? false,
    }))
  },
})

/** A group with its members' balances, settle-up plan and insights. */
export const get = query({
  args: { groupId: v.string() },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const group = await findGroup(ctx, userId, args.groupId)
    if (!group) return null
    const isOwner = group.userId === userId
    // For the owner's edit form: which of their friends each member is.
    const friendByUser = new Map<string, Id<'friends'>>()
    if (isOwner) {
      const friends = await ctx.db
        .query('friends')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .take(500)
      for (const f of friends) if (f.linkedUserId) friendByUser.set(f.linkedUserId, f._id)
    }
    const upi = await upiIds(
      ctx,
      group.members.flatMap((m) => memberUserId(group, m) ?? []),
    )
    return {
      id: group._id,
      name: group.name,
      currency: group.currency,
      isOwner,
      archived: group.archived ?? false,
      budgetCents: group.budgetCents ?? null,
      // Only the owner manages the links.
      inviteToken: isOwner ? (group.inviteToken ?? null) : null,
      shareToken: isOwner ? (group.shareToken ?? null) : null,
      // The viewer's own member, whoever they are.
      meMemberId: viewerMemberId(group, userId) ?? group.meMemberId,
      members: group.members.map(({ userId: memberUser, ...m }) => {
        const settlrUser = memberUser ?? (m.id === group.meMemberId ? group.userId : undefined)
        return {
          ...m,
          netCents: memberNet(m),
          linked: Boolean(memberUser) || m.id === group.meMemberId,
          friendId: memberUser ? (friendByUser.get(memberUser) ?? null) : null,
          upiId: settlrUser ? (upi.get(settlrUser) ?? null) : null,
        }
      }),
      settlements: settleUp(group.members),
      expenseCount: group.expenseCount,
      totalCents: group.totalCents,
      byCategory: Object.entries(group.byCategory)
        .map(([category, cents]) => ({ category, cents }))
        .sort((a, b) => b.cents - a.cents),
      byMonth: Object.entries(group.byMonth)
        .map(([month, cents]) => ({ month, cents }))
        .sort((a, b) => a.month.localeCompare(b.month)),
      lastExpenseAt: group.lastExpenseAt ?? null,
    }
  },
})

/**
 * A group's expenses, filtered and sorted, as a "show more" list: returns
 * up to `limit` rows and whether there are more.
 */
export const expenses = query({
  args: {
    groupId: v.string(),
    q: v.string(),
    category: v.union(v.literal('all'), category),
    paidBy: v.string(),
    sort: v.union(v.literal('date'), v.literal('amount')),
    order: v.union(v.literal('desc'), v.literal('asc')),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const group = await findGroup(ctx, userId, args.groupId)
    if (!group) return { items: [], hasMore: false }
    const limit = input.listLimit(args.limit)
    const q = args.q.trim().slice(0, 100)

    let rows: Array<Doc<'groupExpenses'>>
    if (q) {
      // Text search ranks by relevance; the requested sort is applied to
      // the matches that come back.
      rows = await ctx.db
        .query('groupExpenses')
        .withSearchIndex('search_description', (s) => {
          let search = s.search('description', q).eq('groupId', group._id)
          if (args.category !== 'all') search = search.eq('category', args.category)
          if (args.paidBy) search = search.eq('paidBy', args.paidBy)
          return search
        })
        .take(limit + 1)
      const dir = args.order === 'asc' ? 1 : -1
      rows.sort((a, b) =>
        args.sort === 'amount'
          ? (a.amountCents - b.amountCents) * dir
          : a.date.localeCompare(b.date) * dir,
      )
    } else {
      const indexed =
        args.sort === 'amount'
          ? ctx.db
              .query('groupExpenses')
              .withIndex('by_groupId_and_amountCents', (i) =>
                i.eq('groupId', group._id),
              )
          : ctx.db
              .query('groupExpenses')
              .withIndex('by_groupId_and_date', (i) => i.eq('groupId', group._id))
      rows = await indexed
        .order(args.order)
        .filter((f) =>
          f.and(
            args.category === 'all'
              ? true
              : f.eq(f.field('category'), args.category),
            args.paidBy ? f.eq(f.field('paidBy'), args.paidBy) : true,
          ),
        )
        .take(limit + 1)
    }

    return {
      items: rows.slice(0, limit).map((e) => ({
        id: e._id,
        description: e.description,
        amountCents: e.amountCents,
        paidBy: e.paidBy,
        splitAmong: e.splitAmong,
        splitMode: e.split?.mode ?? ('equal' as const),
        // How it was split, as typed (the edit dialog starts from it).
        split: e.split ?? null,
        owed: Object.fromEntries(shares(e, group.members.map((m) => m.id))),
        original: e.original ?? null,
        tags: e.tags ?? [],
        recurring: e.recurringId !== undefined,
        category: e.category,
        date: e.date,
        receiptId: e.receiptId ?? null,
      })),
      hasMore: rows.length > limit,
    }
  },
})

/** One expense, for the edit form. Null if it's missing or not in a group of yours. */
export const expense = query({
  args: { groupId: v.string(), expenseId: v.string() },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const group = await findGroup(ctx, userId, args.groupId)
    const id = ctx.db.normalizeId('groupExpenses', args.expenseId)
    const expense = group && id ? await ctx.db.get('groupExpenses', id) : null
    if (!group || !expense || expense.groupId !== group._id) return null
    return {
      id: expense._id,
      description: expense.description,
      amountCents: expense.amountCents,
      paidBy: expense.paidBy,
      splitAmong: expense.splitAmong,
      split: expense.split ?? null,
      original: expense.original ?? null,
      tags: expense.tags ?? [],
      category: expense.category,
      date: expense.date,
      receiptId: expense.receiptId ?? null,
    }
  },
})

// How many recent payments `payments` returns.
const RECENT_PAYMENTS = 10

/** A group's latest settle-up payments, newest first. */
export const payments = query({
  args: { groupId: v.string() },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const group = await findGroup(ctx, userId, args.groupId)
    if (!group) return []
    const rows = await ctx.db
      .query('groupPayments')
      .withIndex('by_groupId_and_date', (q) => q.eq('groupId', group._id))
      .order('desc')
      .take(RECENT_PAYMENTS)
    const me = viewerMemberId(group, userId)
    return rows.map((p) => ({
      id: p._id,
      from: p.from,
      to: p.to,
      amountCents: p.amountCents,
      date: p.date,
      unconfirmed: p.unconfirmed ?? false,
      // The recipient confirms a payment someone else recorded.
      canConfirm: Boolean(p.unconfirmed) && p.to === me && p.recordedBy !== userId,
    }))
  },
})

/** Creates a group with the caller as its first member. */
export const create = mutation({
  args: { name: v.string(), currency, members: v.array(v.string()) },
  handler: async (ctx, args): Promise<Id<'groups'>> => {
    const { userId, name: myName } = await requireUser(ctx)
    const name = input.text(args.name, 'Group name', 60)
    const others = args.members.map((m) => input.text(m, 'Member name', 40))
    const names = [myName, ...others]
    if (others.length < 1) {
      throw new ConvexError('Add at least one other member.')
    }
    if (names.length > MAX_MEMBERS) {
      throw new ConvexError(`A group can have up to ${MAX_MEMBERS} members.`)
    }
    if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) {
      throw new ConvexError('Member names must be unique.')
    }

    const existing = await ctx.db
      .query('groups')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .take(MAX_GROUPS)
    if (existing.length >= MAX_GROUPS) {
      throw new ConvexError(`You can have up to ${MAX_GROUPS} groups.`)
    }

    const members = names.map((memberName, i) => ({
      id: `m${i + 1}`,
      name: memberName,
      paidCents: 0,
      owedCents: 0,
    }))
    return await ctx.db.insert('groups', {
      userId,
      name,
      currency: args.currency,
      members,
      meMemberId: members[0].id,
      expenseCount: 0,
      totalCents: 0,
      byCategory: {},
      byMonth: {},
    })
  },
})

// Above this many expenses, `update` won't scan to confirm a member is unused.
const MAX_SCAN_FOR_REMOVAL = 5000

/**
 * Edits a group: its name, its currency (only while it has no expenses) and
 * its members. `members` is the full new list: entries with an `id` keep
 * (and may rename) that member, entries without one are added, and members
 * left out are removed, which is only allowed for people who aren't part of
 * any expense. You can't remove yourself.
 */
export const update = mutation({
  args: {
    groupId: v.id('groups'),
    name: v.string(),
    currency,
    members: v.array(
      v.object({
        id: v.optional(v.string()),
        name: v.string(),
        // Link this member to one of your connected friends' accounts; null
        // or absent leaves them unlinked.
        friendId: v.optional(v.union(v.id('friends'), v.null())),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { userId, name: myName } = await requireUser(ctx)
    const group = await requireOwnedGroup(ctx, userId, args.groupId)
    const name = input.text(args.name, 'Group name', 60)

    if (args.currency !== group.currency) {
      const payment = await ctx.db
        .query('groupPayments')
        .withIndex('by_groupId_and_date', (q) => q.eq('groupId', group._id))
        .first()
      if (group.expenseCount > 0 || payment !== null) {
        throw new ConvexError(
          'The currency can only change while the group has no expenses or payments.',
        )
      }
    }

    const current = new Map(group.members.map((m) => [m.id, m]))
    const kept = new Set<string>()
    for (const member of args.members) {
      if (member.id === undefined) continue
      if (!current.has(member.id)) {
        throw new ConvexError('That member is no longer in this group.')
      }
      if (kept.has(member.id)) throw new ConvexError('A member is listed twice.')
      kept.add(member.id)
    }
    if (!kept.has(group.meMemberId)) {
      throw new ConvexError('You can’t remove yourself from your own group.')
    }

    // Removing someone who is on an expense would change everyone's
    // balances, so only unused members can go.
    const removed = group.members.filter((m) => !kept.has(m.id))
    const onExpenses = removed.filter((m) => m.paidCents !== 0 || m.owedCents !== 0)
    if (onExpenses.length > 0) {
      throw new ConvexError(
        `${onExpenses[0].name} is part of expenses in this group. Delete those expenses before removing them.`,
      )
    }
    if (removed.length > 0) {
      const removedIds = new Set(removed.map((m) => m.id))
      for await (const payment of ctx.db
        .query('groupPayments')
        .withIndex('by_groupId_and_date', (q) => q.eq('groupId', group._id))) {
        const hit = [payment.from, payment.to].find((id) => removedIds.has(id))
        if (hit) {
          const who = removed.find((m) => m.id === hit)?.name ?? 'A member'
          throw new ConvexError(
            `${who} is part of a settle-up payment. Delete that payment before removing them.`,
          )
        }
      }
    }
    if (removed.length > 0 && group.expenseCount > 0) {
      // Zero totals can still hide a 0¢ share of a tiny expense; check.
      if (group.expenseCount > MAX_SCAN_FOR_REMOVAL) {
        throw new ConvexError('This group has too many expenses to remove members.')
      }
      const removedIds = new Set(removed.map((m) => m.id))
      for await (const expense of ctx.db
        .query('groupExpenses')
        .withIndex('by_groupId_and_date', (q) => q.eq('groupId', group._id))) {
        const hit = [expense.paidBy, ...expense.splitAmong].find((id) =>
          removedIds.has(id),
        )
        if (hit) {
          const who = removed.find((m) => m.id === hit)?.name ?? 'A member'
          throw new ConvexError(
            `${who} is part of “${expense.description}”. Delete that expense before removing them.`,
          )
        }
      }
    }

    // Links can only point at your own connected friends.
    const myFriends = await ctx.db
      .query('friends')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .take(500)
    const linkedUserOf = new Map(
      myFriends.flatMap((f) => (f.linkedUserId ? [[f._id, f.linkedUserId] as const] : [])),
    )
    const usedUsers = new Set<string>()

    // New ids continue after the highest one in use.
    let nextNumber =
      Math.max(0, ...group.members.map((m) => Number(m.id.slice(1)) || 0)) + 1
    const members = args.members.map((member): Member => {
      const isOwner = member.id === group.meMemberId
      const memberName = isOwner
        ? current.get(member.id!)!.name
        : input.text(member.name, 'Member name', 40)
      let memberUser: string | undefined
      if (!isOwner && member.friendId) {
        memberUser = linkedUserOf.get(member.friendId)
        if (!memberUser) {
          throw new ConvexError(
            `${memberName} can only be linked to a friend who has accepted your friend request.`,
          )
        }
        if (usedUsers.has(memberUser)) {
          throw new ConvexError('The same friend is linked to two members.')
        }
        usedUsers.add(memberUser)
      }
      const base =
        member.id !== undefined
          ? current.get(member.id)!
          : { id: `m${nextNumber++}`, paidCents: 0, owedCents: 0 }
      const { userId: _, ...rest } = base as Member
      return memberUser
        ? { ...rest, name: memberName, userId: memberUser }
        : { ...rest, name: memberName }
    })

    if (members.length < 2) throw new ConvexError('A group needs at least two members.')
    if (members.length > MAX_MEMBERS) {
      throw new ConvexError(`A group can have up to ${MAX_MEMBERS} members.`)
    }
    if (new Set(members.map((m) => m.name.toLowerCase())).size !== members.length) {
      throw new ConvexError('Member names must be unique.')
    }

    await ctx.db.patch('groups', group._id, { name, currency: args.currency, members })
    const updated = (await ctx.db.get('groups', group._id))!
    const before = new Set(await syncMemberships(ctx, updated))
    for (const member of members) {
      if (member.userId && !before.has(member.userId)) {
        await notify(ctx, {
          userId: member.userId,
          kind: 'group_added',
          actorName: myName,
          groupId: group._id,
          groupName: name,
        })
      }
    }
    return null
  },
})

/** Deletes a group and all of its expenses and payments. */
export const remove = mutation({
  args: { groupId: v.id('groups') },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const group = await requireOwnedGroup(ctx, userId, args.groupId)
    const memberships = await ctx.db
      .query('groupMembers')
      .withIndex('by_groupId', (q) => q.eq('groupId', group._id))
      .take(MAX_MEMBERS * 2)
    for (const row of memberships) await ctx.db.delete('groupMembers', row._id)
    await ctx.db.delete('groups', group._id)
    await ctx.scheduler.runAfter(0, internal.groups.deleteExpenses, {
      groupId: group._id,
    })
    return null
  },
})

export const deleteExpenses = internalMutation({
  args: { groupId: v.id('groups') },
  handler: async (ctx, args) => {
    const batch = await ctx.db
      .query('groupExpenses')
      .withIndex('by_groupId_and_date', (q) => q.eq('groupId', args.groupId))
      .take(200)
    for (const row of batch) {
      await ctx.db.delete('groupExpenses', row._id)
      if (row.receiptId) await deleteReceipt(ctx, row.receiptId)
      const comments = await ctx.db
        .query('comments')
        .withIndex('by_expenseId', (q) => q.eq('expenseId', row._id))
        .take(200)
      for (const c of comments) await ctx.db.delete('comments', c._id)
    }
    if (batch.length === 200) {
      await ctx.scheduler.runAfter(0, internal.groups.deleteExpenses, args)
      return null
    }
    // Expenses are gone; now the payments, in batches too.
    const payments = await ctx.db
      .query('groupPayments')
      .withIndex('by_groupId_and_date', (q) => q.eq('groupId', args.groupId))
      .take(200)
    for (const row of payments) await ctx.db.delete('groupPayments', row._id)
    if (payments.length === 200) {
      await ctx.scheduler.runAfter(0, internal.groups.deleteExpenses, args)
      return null
    }
    // Then the activity log.
    const activity = await ctx.db
      .query('activity')
      .withIndex('by_groupId', (q) => q.eq('groupId', args.groupId))
      .take(200)
    for (const row of activity) await ctx.db.delete('activity', row._id)
    if (activity.length === 200) {
      await ctx.scheduler.runAfter(0, internal.groups.deleteExpenses, args)
    }
    return null
  },
})

const expenseFields = {
  description: v.string(),
  amountCents: v.number(),
  paidBy: v.string(),
  splitAmong: v.array(v.string()),
  category,
  date: v.string(),
  // Absent: split equally between `splitAmong`.
  split: v.optional(groupSplitInput),
  original: v.optional(original),
  tags: v.optional(v.array(v.string())),
}

type ExpenseInput = {
  description: string
  amountCents: number
  paidBy: string
  splitAmong: Array<string>
  category: Doc<'groupExpenses'>['category']
  date: string
  split?: typeof groupSplitInput.type
  original?: typeof original.type
  tags?: Array<string>
}

// Checks an expense's fields against the group and cleans them up.
export function checkExpense(group: Doc<'groups'>, args: ExpenseInput) {
  const order = group.members.map((m) => m.id)
  const memberIds = new Set(order)
  if (!memberIds.has(args.paidBy)) {
    throw new ConvexError('The payer is not a member of this group.')
  }
  const amountCents = input.amount(args.amountCents)
  let splitAmong = [...new Set(args.splitAmong)]
  let split: Doc<'groupExpenses'>['split']
  if (args.split) {
    const resolved = resolveSplit(order, amountCents, args.split)
    split = resolved.split
    splitAmong = resolved.splitAmong
  } else {
    if (splitAmong.length === 0) {
      throw new ConvexError('Split between at least one person.')
    }
    if (!splitAmong.every((id) => memberIds.has(id))) {
      throw new ConvexError('Expenses can only be split between group members.')
    }
  }
  if (args.original) {
    const o = args.original
    if (o.currency === group.currency) {
      throw new ConvexError('The original currency is already the group’s currency.')
    }
    input.amount(o.amountCents)
    if (!Number.isFinite(o.rate) || o.rate <= 0 || o.rate > 1_000_000) {
      throw new ConvexError('Enter a valid exchange rate.')
    }
  }
  return {
    groupId: group._id,
    description: input.text(args.description, 'Description', 80),
    amountCents,
    paidBy: args.paidBy,
    splitAmong,
    split,
    original: args.original,
    tags: input.tags(args.tags),
    category: args.category,
    date: input.isoDate(args.date),
  }
}

type ExpenseEffect = Pick<Doc<'groupExpenses'>, 'amountCents' | 'paidBy' | 'splitAmong' | 'split'>

// What an expense means for one member: what they paid minus their share.
function memberEffect(group: Doc<'groups'>, expense: ExpenseEffect, memberId: string) {
  const owed = shares(expense, group.members.map((m) => m.id))
  return (memberId === expense.paidBy ? expense.amountCents : 0) - (owed.get(memberId) ?? 0)
}

function isPartOf(expense: ExpenseEffect, memberId: string) {
  return expense.paidBy === memberId || expense.splitAmong.includes(memberId)
}

type NewGroupExpense = Omit<Doc<'groupExpenses'>, '_id' | '_creationTime'>

/**
 * Inserts a checked expense, updates the group's totals and tells everyone
 * on Settlr who's part of it. Shared by the form, recurring expenses, the
 * Splitwise import and restoring from the trash.
 */
export async function insertGroupExpense(
  ctx: MutationCtx,
  me: User,
  group: Doc<'groups'>,
  expense: NewGroupExpense,
  { quiet = false, restored = false } = {},
) {
  const expenseId = await ctx.db.insert('groupExpenses', expense)
  await ctx.db.patch('groups', group._id, {
    ...applyGroupExpense(group, expense, 1),
    lastExpenseAt: Date.now(),
  })
  await logActivity(ctx, {
    groupId: group._id,
    actorName: me.name,
    kind: restored ? 'expense_restored' : 'expense_added',
    description: expense.description,
    amountCents: expense.amountCents,
    expenseId,
  })
  if (quiet) return expenseId

  // Tell everyone on Settlr who's part of it (except whoever added it)
  // what it means for them: paid minus their share.
  for (const member of group.members) {
    const memberUser = memberUserId(group, member)
    if (!memberUser || memberUser === me.userId) continue
    if (!isPartOf(expense, member.id)) continue
    await notify(ctx, {
      userId: memberUser,
      kind: 'group_expense',
      actorName: me.name,
      description: expense.description,
      amountCents: memberEffect(group, expense, member.id),
      currency: group.currency,
      groupId: group._id,
      groupName: group.name,
    })
  }
  return expenseId
}

export const addExpense = mutation({
  args: { groupId: v.id('groups'), ...expenseFields, receiptId: v.optional(v.id('receipts')) },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    const group = await requireGroup(ctx, me.userId, args.groupId)
    const expense = {
      ...checkExpense(group, args),
      receiptId: await attachReceipt(ctx, me.userId, args.receiptId),
    }
    return await insertGroupExpense(ctx, me, group, expense)
  },
})

/**
 * Edits an expense. Any member can, like adding or deleting one. `receiptId`
 * is the receipt it should end up with.
 */
export const updateExpense = mutation({
  args: {
    expenseId: v.id('groupExpenses'),
    ...expenseFields,
    receiptId: v.union(v.id('receipts'), v.null()),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    const old = await ctx.db.get('groupExpenses', args.expenseId)
    const group = old ? await findGroup(ctx, me.userId, old.groupId) : null
    if (!old || !group) throw new ConvexError('That expense doesn’t exist.')
    const next = {
      ...checkExpense(group, args),
      receiptId: await attachReceipt(ctx, me.userId, args.receiptId, old.receiptId),
      recurringId: old.recurringId,
    }
    await ctx.db.replace('groupExpenses', old._id, next)
    const without = { ...group, ...applyGroupExpense(group, old, -1) }
    await ctx.db.patch('groups', group._id, applyGroupExpense(without, next, 1))
    await logActivity(ctx, {
      groupId: group._id,
      actorName: me.name,
      kind: 'expense_updated',
      description:
        old.amountCents !== next.amountCents
          ? `${next.description} (was ${old.amountCents / 100})`
          : next.description,
      amountCents: next.amountCents,
      expenseId: old._id,
    })

    // Tell everyone on Settlr who was or is part of it where they stand now.
    for (const member of group.members) {
      const memberUser = memberUserId(group, member)
      if (!memberUser || memberUser === me.userId) continue
      if (!isPartOf(old, member.id) && !isPartOf(next, member.id)) continue
      await notify(ctx, {
        userId: memberUser,
        kind: 'group_expense_updated',
        actorName: me.name,
        description: next.description,
        amountCents: memberEffect(group, next, member.id),
        currency: group.currency,
        groupId: group._id,
        groupName: group.name,
      })
    }
    return null
  },
})

/**
 * Deletes an expense into the trash (restorable for 30 days; returns the
 * trash row for the toast's Undo). Its comments go with it.
 */
export const removeExpense = mutation({
  args: { expenseId: v.id('groupExpenses') },
  handler: async (ctx, args): Promise<Id<'trash'>> => {
    const me = await requireUser(ctx)
    const expense = await ctx.db.get('groupExpenses', args.expenseId)
    const group = expense ? await findGroup(ctx, me.userId, expense.groupId) : null
    if (!expense || !group) throw new ConvexError('That expense doesn’t exist.')
    await ctx.db.delete('groupExpenses', expense._id)
    await ctx.db.patch('groups', group._id, applyGroupExpense(group, expense, -1))
    const comments = await ctx.db
      .query('comments')
      .withIndex('by_expenseId', (q) => q.eq('expenseId', expense._id))
      .take(500)
    for (const c of comments) await ctx.db.delete('comments', c._id)
    await logActivity(ctx, {
      groupId: group._id,
      actorName: me.name,
      kind: 'expense_deleted',
      description: expense.description,
      amountCents: expense.amountCents,
    })
    return await ctx.db.insert('trash', {
      userId: me.userId,
      description: expense.description,
      amountCents: expense.amountCents,
      currency: group.currency,
      where: group.name,
      item: {
        kind: 'group',
        groupId: group._id,
        expense: {
          description: expense.description,
          amountCents: expense.amountCents,
          paidBy: expense.paidBy,
          splitAmong: expense.splitAmong,
          category: expense.category,
          date: expense.date,
          receiptId: expense.receiptId,
          split: expense.split,
          original: expense.original,
          tags: expense.tags,
          recurringId: expense.recurringId,
        },
      },
    })
  },
})

/**
 * Records a settle-up payment from one member to another. Any member can,
 * like adding an expense. A linked recipient who didn't record it is asked
 * to confirm it.
 */
export const addPayment = mutation({
  args: {
    groupId: v.id('groups'),
    from: v.string(),
    to: v.string(),
    amountCents: v.number(),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    const group = await requireGroup(ctx, me.userId, args.groupId)
    return await insertGroupPayment(ctx, me, group, args)
  },
})

export async function insertGroupPayment(
  ctx: MutationCtx,
  me: User,
  group: Doc<'groups'>,
  args: { from: string; to: string; amountCents: number; date: string },
) {
  const memberIds = new Set(group.members.map((m) => m.id))
  if (!memberIds.has(args.from) || !memberIds.has(args.to)) {
    throw new ConvexError('Payments can only be between group members.')
  }
  if (args.from === args.to) {
    throw new ConvexError('Pick two different people.')
  }
  const recipient = group.members.find((m) => m.id === args.to)!
  const recipientUser = memberUserId(group, recipient)
  const payment = {
    groupId: group._id,
    from: args.from,
    to: args.to,
    amountCents: input.amount(args.amountCents),
    date: input.isoDate(args.date),
    recordedBy: me.userId,
    unconfirmed: recipientUser !== undefined && recipientUser !== me.userId ? true : undefined,
  }
  const paymentId = await ctx.db.insert('groupPayments', payment)
  await ctx.db.patch('groups', group._id, applyGroupPayment(group, payment, 1))

  const nameOf = (id: string) => group.members.find((m) => m.id === id)?.name ?? 'Someone'
  await logActivity(ctx, {
    groupId: group._id,
    actorName: me.name,
    kind: 'payment_added',
    description: `${nameOf(payment.from)} paid ${nameOf(payment.to)}`,
    amountCents: payment.amountCents,
  })

  // Tell the payer and the recipient (if they're on Settlr and didn't
  // record it themselves).
  for (const member of group.members) {
    if (member.id !== payment.from && member.id !== payment.to) continue
    const memberUser = memberUserId(group, member)
    if (!memberUser || memberUser === me.userId) continue
    await notify(ctx, {
      userId: memberUser,
      kind: 'group_payment',
      actorName: me.name,
      description:
        member.id === payment.to
          ? `${nameOf(payment.from)} paid you${payment.unconfirmed ? ' (confirm it in the group)' : ''}`
          : `You paid ${nameOf(payment.to)}`,
      amountCents: payment.amountCents,
      currency: group.currency,
      groupId: group._id,
      groupName: group.name,
    })
  }
  return paymentId
}

async function requirePayment(ctx: QueryCtx, userId: string, paymentId: Id<'groupPayments'>) {
  const payment = await ctx.db.get('groupPayments', paymentId)
  const group = payment ? await findGroup(ctx, userId, payment.groupId) : null
  if (!payment || !group) throw new ConvexError('That payment doesn’t exist.')
  return { payment, group }
}

/** Deletes a settle-up payment, putting the balances back. */
export const removePayment = mutation({
  args: { paymentId: v.id('groupPayments') },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    const { payment, group } = await requirePayment(ctx, me.userId, args.paymentId)
    await ctx.db.delete('groupPayments', payment._id)
    await ctx.db.patch('groups', group._id, applyGroupPayment(group, payment, -1))
    await logActivity(ctx, {
      groupId: group._id,
      actorName: me.name,
      kind: 'payment_deleted',
      description: 'Deleted a payment',
      amountCents: payment.amountCents,
    })
    return null
  },
})

/**
 * The recipient answers a payment someone else recorded: confirming keeps
 * it, rejecting ("I didn't get it") deletes it. The recorder is told.
 */
export const answerPayment = mutation({
  args: { paymentId: v.id('groupPayments'), confirm: v.boolean() },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    const { payment, group } = await requirePayment(ctx, me.userId, args.paymentId)
    if (!payment.unconfirmed || viewerMemberId(group, me.userId) !== payment.to) {
      throw new ConvexError('Only the person who got this payment can confirm it.')
    }
    if (args.confirm) {
      await ctx.db.patch('groupPayments', payment._id, { unconfirmed: undefined })
    } else {
      await ctx.db.delete('groupPayments', payment._id)
      await ctx.db.patch('groups', group._id, applyGroupPayment(group, payment, -1))
    }
    await logActivity(ctx, {
      groupId: group._id,
      actorName: me.name,
      kind: args.confirm ? 'payment_confirmed' : 'payment_deleted',
      description: args.confirm ? 'Confirmed a payment' : 'Said a payment never arrived',
      amountCents: payment.amountCents,
    })
    if (payment.recordedBy && payment.recordedBy !== me.userId) {
      await notify(ctx, {
        userId: payment.recordedBy,
        kind: args.confirm ? 'payment_confirmed' : 'payment_rejected',
        actorName: me.name,
        amountCents: payment.amountCents,
        currency: group.currency,
        groupId: group._id,
        groupName: group.name,
      })
    }
    return null
  },
})

/** Reminds a linked member who owes money in the group (you must be owed). */
export const remindMember = mutation({
  args: { groupId: v.id('groups'), memberId: v.string() },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    const group = await requireGroup(ctx, me.userId, args.groupId)
    const meId = viewerMemberId(group, me.userId)
    const plan = settleUp(group.members).find(
      (s) => s.from === args.memberId && s.to === meId,
    )
    if (!plan) throw new ConvexError('They don’t owe you anything here.')
    const member = group.members.find((m) => m.id === args.memberId)!
    const memberUser = memberUserId(group, member)
    if (!memberUser) {
      throw new ConvexError(`${member.name} isn’t on Settlr, so they can’t get a reminder.`)
    }
    await notify(ctx, {
      userId: memberUser,
      kind: 'reminder',
      actorName: me.name,
      description: `You owe ${me.name} in ${group.name}`,
      amountCents: plan.amountCents,
      currency: group.currency,
      groupId: group._id,
      groupName: group.name,
    })
    return null
  },
})

/** Archives or unarchives a group (owner only). It must be settled to archive. */
export const setArchived = mutation({
  args: { groupId: v.id('groups'), archived: v.boolean() },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const group = await requireOwnedGroup(ctx, userId, args.groupId)
    if (args.archived && group.members.some((m) => memberNet(m) !== 0)) {
      throw new ConvexError('Settle up everyone before archiving the group.')
    }
    await ctx.db.patch('groups', group._id, { archived: args.archived || undefined })
    return null
  },
})

/** Sets or clears the group's total budget (owner only). */
export const setBudget = mutation({
  args: { groupId: v.id('groups'), budgetCents: v.union(v.number(), v.null()) },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const group = await requireOwnedGroup(ctx, userId, args.groupId)
    await ctx.db.patch('groups', group._id, {
      budgetCents: args.budgetCents === null ? undefined : input.amount(args.budgetCents),
    })
    return null
  },
})

/**
 * Turns the join link or the read-only share link on (a new token, so an
 * old link stops working) or off. Owner only.
 */
export const setLink = mutation({
  args: {
    groupId: v.id('groups'),
    link: v.union(v.literal('invite'), v.literal('share')),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const group = await requireOwnedGroup(ctx, userId, args.groupId)
    const token = args.enabled ? newToken() : undefined
    await ctx.db.patch(
      'groups',
      group._id,
      args.link === 'invite' ? { inviteToken: token } : { shareToken: token },
    )
    return token ?? null
  },
})

async function groupByInvite(ctx: QueryCtx, token: string) {
  if (!/^[0-9a-f]{32}$/.test(token)) return null
  return await ctx.db
    .query('groups')
    .withIndex('by_inviteToken', (q) => q.eq('inviteToken', token))
    .unique()
}

/** What the join page shows: the group and which members are free to claim. */
export const invite = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const group = await groupByInvite(ctx, args.token)
    if (!group) return null
    return {
      groupId: group._id,
      name: group.name,
      currency: group.currency,
      alreadyMember: viewerMemberId(group, userId) !== null,
      // Members nobody has claimed yet (not the owner, not linked).
      open: group.members
        .filter((m) => !memberUserId(group, m))
        .map((m) => ({ id: m.id, name: m.name })),
      full: group.members.length >= MAX_MEMBERS,
    }
  },
})

/**
 * Joins a group through its invite link: as one of the unclaimed members
 * (keeping their history), or as a new member under your name.
 */
export const join = mutation({
  args: { token: v.string(), memberId: v.union(v.string(), v.null()) },
  handler: async (ctx, args): Promise<Id<'groups'>> => {
    const me = await requireUser(ctx)
    const group = await groupByInvite(ctx, args.token)
    if (!group) throw new ConvexError('This invite link no longer works. Ask for a new one.')
    if (viewerMemberId(group, me.userId) !== null) return group._id
    let members: Array<Member>
    let joinedAs: string
    if (args.memberId) {
      const member = group.members.find((m) => m.id === args.memberId)
      if (!member || memberUserId(group, member)) {
        throw new ConvexError('Someone has already joined as that member.')
      }
      members = group.members.map((m) => (m.id === member.id ? { ...m, userId: me.userId } : m))
      joinedAs = member.name
    } else {
      if (group.members.length >= MAX_MEMBERS) {
        throw new ConvexError(`A group can have up to ${MAX_MEMBERS} members.`)
      }
      let name = me.name
      const taken = new Set(group.members.map((m) => m.name.toLowerCase()))
      for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${me.name} ${n}`
      const next = Math.max(0, ...group.members.map((m) => Number(m.id.slice(1)) || 0)) + 1
      members = [
        ...group.members,
        { id: `m${next}`, name, paidCents: 0, owedCents: 0, userId: me.userId },
      ]
      joinedAs = name
    }
    await ctx.db.patch('groups', group._id, { members })
    await syncMemberships(ctx, (await ctx.db.get('groups', group._id))!)
    await logActivity(ctx, {
      groupId: group._id,
      actorName: me.name,
      kind: 'member_joined',
      description: joinedAs === me.name ? 'Joined the group' : `Joined as ${joinedAs}`,
    })
    await notify(ctx, {
      userId: group.userId,
      kind: 'group_joined',
      actorName: me.name,
      description: joinedAs === me.name ? undefined : `as ${joinedAs}`,
      groupId: group._id,
      groupName: group.name,
    })
    return group._id
  },
})

/**
 * The public, read-only view of a group behind its share link: balances,
 * the settle-up plan and the latest expenses. No sign-in needed.
 */
export const shared = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    if (!/^[0-9a-f]{32}$/.test(args.token)) return null
    const group = await ctx.db
      .query('groups')
      .withIndex('by_shareToken', (q) => q.eq('shareToken', args.token))
      .unique()
    if (!group) return null
    const order = group.members.map((m) => m.id)
    const expenses = await ctx.db
      .query('groupExpenses')
      .withIndex('by_groupId_and_date', (q) => q.eq('groupId', group._id))
      .order('desc')
      .take(100)
    return {
      name: group.name,
      currency: group.currency,
      totalCents: group.totalCents,
      expenseCount: group.expenseCount,
      members: group.members.map((m) => ({ id: m.id, name: m.name, netCents: memberNet(m) })),
      settlements: settleUp(group.members),
      expenses: expenses.map((e) => ({
        id: e._id,
        description: e.description,
        amountCents: e.amountCents,
        paidBy: e.paidBy,
        category: e.category,
        date: e.date,
        owed: Object.fromEntries(shares(e, order)),
      })),
    }
  },
})

/** A group's activity log, newest first. */
export const activity = query({
  args: { groupId: v.string(), limit: v.number() },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const group = await findGroup(ctx, userId, args.groupId)
    if (!group) return []
    const rows = await ctx.db
      .query('activity')
      .withIndex('by_groupId', (q) => q.eq('groupId', group._id))
      .order('desc')
      .take(input.listLimit(args.limit))
    return rows.map((a) => ({
      id: a._id,
      at: a._creationTime,
      actorName: a.actorName,
      kind: a.kind,
      description: a.description,
      amountCents: a.amountCents ?? null,
      expenseId: a.expenseId ?? null,
    }))
  },
})

/** Comments on a group expense, oldest first. */
export const comments = query({
  args: { expenseId: v.string() },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const id = ctx.db.normalizeId('groupExpenses', args.expenseId)
    const expense = id ? await ctx.db.get('groupExpenses', id) : null
    const group = expense ? await findGroup(ctx, userId, expense.groupId) : null
    if (!expense || !group) return []
    const rows = await ctx.db
      .query('comments')
      .withIndex('by_expenseId', (q) => q.eq('expenseId', expense._id))
      .take(200)
    return rows.map((c) => ({
      id: c._id,
      at: c._creationTime,
      name: c.name,
      body: c.body,
      mine: c.userId === userId,
    }))
  },
})

export const addComment = mutation({
  args: { expenseId: v.id('groupExpenses'), body: v.string() },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    const expense = await ctx.db.get('groupExpenses', args.expenseId)
    const group = expense ? await findGroup(ctx, me.userId, expense.groupId) : null
    if (!expense || !group) throw new ConvexError('That expense doesn’t exist.')
    const body = input.text(args.body, 'Comment', 500)
    await ctx.db.insert('comments', {
      groupId: group._id,
      expenseId: expense._id,
      userId: me.userId,
      name: me.name,
      body,
    })
    await logActivity(ctx, {
      groupId: group._id,
      actorName: me.name,
      kind: 'comment',
      description: `On “${expense.description}”: ${body.slice(0, 80)}`,
      expenseId: expense._id,
    })
    // Tell whoever's part of it.
    for (const member of group.members) {
      const memberUser = memberUserId(group, member)
      if (!memberUser || memberUser === me.userId || !isPartOf(expense, member.id)) continue
      await notify(ctx, {
        userId: memberUser,
        kind: 'comment',
        actorName: me.name,
        description: `On “${expense.description}”: ${body.slice(0, 120)}`,
        groupId: group._id,
        groupName: group.name,
      })
    }
    return null
  },
})

export const removeComment = mutation({
  args: { commentId: v.id('comments') },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const comment = await ctx.db.get('comments', args.commentId)
    if (!comment || comment.userId !== userId) {
      throw new ConvexError('You can only delete your own comments.')
    }
    await ctx.db.delete('comments', comment._id)
    return null
  },
})
