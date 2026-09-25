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
import { applyGroupExpense, settleUp, shares } from './lib/ledger'
import { notify } from './lib/notify'
import { attachReceipt, deleteReceipt } from './lib/receipts'
import { category, currency } from './lib/validators'

const MAX_GROUPS = 200
const MAX_MEMBERS = 20

type Member = Doc<'groups'>['members'][number]

// The Settlr user a member is: linked members have one, and the owner's
// member is the owner.
function memberUserId(group: Doc<'groups'>, member: Member) {
  return member.userId ?? (member.id === group.meMemberId ? group.userId : undefined)
}

// Which member the viewer is (the owner, or a linked member).
function viewerMemberId(group: Doc<'groups'>, userId: string) {
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

async function requireGroup(ctx: QueryCtx, userId: string, groupId: string) {
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
  return me ? me.paidCents - me.owedCents : 0
}

// Keeps the groupMembers index in step with the linked members.
async function syncMemberships(ctx: MutationCtx, group: Doc<'groups'>) {
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

/** The caller's groups, newest first, with where they stand in each. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireUser(ctx)
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
    const groups = [
      ...owned,
      ...joined.filter(
        (g): g is Doc<'groups'> => g !== null && viewerMemberId(g, userId) !== null,
      ),
    ].sort((a, b) => b._creationTime - a._creationTime)
    return groups.map((group) => ({
      id: group._id,
      name: group.name,
      currency: group.currency,
      memberCount: group.members.length,
      expenseCount: group.expenseCount,
      totalCents: group.totalCents,
      myNetCents: myNet(group, userId),
      isOwner: group.userId === userId,
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
    return {
      id: group._id,
      name: group.name,
      currency: group.currency,
      isOwner,
      // The viewer's own member, whoever they are.
      meMemberId: viewerMemberId(group, userId) ?? group.meMemberId,
      members: group.members.map(({ userId: memberUser, ...m }) => ({
        ...m,
        netCents: m.paidCents - m.owedCents,
        linked: Boolean(memberUser) || m.id === group.meMemberId,
        friendId: memberUser ? (friendByUser.get(memberUser) ?? null) : null,
      })),
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
      category: expense.category,
      date: expense.date,
      receiptId: expense.receiptId ?? null,
    }
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

    if (args.currency !== group.currency && group.expenseCount > 0) {
      throw new ConvexError(
        'The currency can only change while the group has no expenses.',
      )
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

/** Deletes a group and all of its expenses. */
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
    }
    if (batch.length === 200) {
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
}

// Checks an expense's fields against the group and cleans them up.
function checkExpense(
  group: Doc<'groups'>,
  args: {
    description: string
    amountCents: number
    paidBy: string
    splitAmong: Array<string>
    category: Doc<'groupExpenses'>['category']
    date: string
  },
) {
  const memberIds = new Set(group.members.map((m) => m.id))
  const splitAmong = [...new Set(args.splitAmong)]
  if (!memberIds.has(args.paidBy)) {
    throw new ConvexError('The payer is not a member of this group.')
  }
  if (splitAmong.length === 0) {
    throw new ConvexError('Split between at least one person.')
  }
  if (!splitAmong.every((id) => memberIds.has(id))) {
    throw new ConvexError('Expenses can only be split between group members.')
  }
  return {
    groupId: group._id,
    description: input.text(args.description, 'Description', 80),
    amountCents: input.amount(args.amountCents),
    paidBy: args.paidBy,
    splitAmong,
    category: args.category,
    date: input.isoDate(args.date),
  }
}

type ExpenseEffect = Pick<Doc<'groupExpenses'>, 'amountCents' | 'paidBy' | 'splitAmong'>

// What an expense means for one member: what they paid minus their share.
function memberEffect(group: Doc<'groups'>, expense: ExpenseEffect, memberId: string) {
  const owed = shares(expense, group.members.map((m) => m.id))
  return (memberId === expense.paidBy ? expense.amountCents : 0) - (owed.get(memberId) ?? 0)
}

function isPartOf(expense: ExpenseEffect, memberId: string) {
  return expense.paidBy === memberId || expense.splitAmong.includes(memberId)
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
    await ctx.db.insert('groupExpenses', expense)
    await ctx.db.patch('groups', group._id, {
      ...applyGroupExpense(group, expense, 1),
      lastExpenseAt: Date.now(),
    })

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
    return null
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
    }
    await ctx.db.replace('groupExpenses', old._id, next)
    const without = { ...group, ...applyGroupExpense(group, old, -1) }
    await ctx.db.patch('groups', group._id, applyGroupExpense(without, next, 1))

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

export const removeExpense = mutation({
  args: { expenseId: v.id('groupExpenses') },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const expense = await ctx.db.get('groupExpenses', args.expenseId)
    const group = expense ? await findGroup(ctx, userId, expense.groupId) : null
    if (!expense || !group) throw new ConvexError('That expense doesn’t exist.')
    await ctx.db.delete('groupExpenses', expense._id)
    await ctx.db.patch('groups', group._id, applyGroupExpense(group, expense, -1))
    if (expense.receiptId) await deleteReceipt(ctx, expense.receiptId)
    return null
  },
})
