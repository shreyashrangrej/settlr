import { ConvexError, v } from 'convex/values'

import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import {
  internalMutation,
  mutation,
  query,
  type QueryCtx,
} from './_generated/server'
import { requireUser } from './lib/auth'
import * as input from './lib/input'
import { applyGroupExpense, settleUp } from './lib/ledger'
import { category, currency } from './lib/validators'

const MAX_GROUPS = 200
const MAX_MEMBERS = 20

// The caller's group, or null if the id is malformed, missing or someone
// else's. Taking a string (not v.id) lets pages turn bad URLs into a 404.
async function findGroup(ctx: QueryCtx, userId: string, groupId: string) {
  const id = ctx.db.normalizeId('groups', groupId)
  const group = id ? await ctx.db.get('groups', id) : null
  return group && group.userId === userId ? group : null
}

async function requireGroup(ctx: QueryCtx, userId: string, groupId: string) {
  const group = await findGroup(ctx, userId, groupId)
  if (!group) throw new ConvexError('That group doesn’t exist.')
  return group
}

function myNet(group: Doc<'groups'>) {
  const me = group.members.find((m) => m.id === group.meMemberId)
  return me ? me.paidCents - me.owedCents : 0
}

/** The caller's groups, newest first, with where they stand in each. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireUser(ctx)
    const groups = await ctx.db
      .query('groups')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .order('desc')
      .take(MAX_GROUPS)
    return groups.map((group) => ({
      id: group._id,
      name: group.name,
      currency: group.currency,
      memberCount: group.members.length,
      expenseCount: group.expenseCount,
      totalCents: group.totalCents,
      myNetCents: myNet(group),
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
    return {
      id: group._id,
      name: group.name,
      currency: group.currency,
      meMemberId: group.meMemberId,
      members: group.members.map((m) => ({
        ...m,
        netCents: m.paidCents - m.owedCents,
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
      })),
      hasMore: rows.length > limit,
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
    members: v.array(v.object({ id: v.optional(v.string()), name: v.string() })),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const group = await requireGroup(ctx, userId, args.groupId)
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

    // New ids continue after the highest one in use.
    let nextNumber =
      Math.max(0, ...group.members.map((m) => Number(m.id.slice(1)) || 0)) + 1
    const members = args.members.map((member) => {
      const memberName =
        member.id === group.meMemberId
          ? current.get(member.id)!.name
          : input.text(member.name, 'Member name', 40)
      if (member.id !== undefined) {
        return { ...current.get(member.id)!, name: memberName }
      }
      return { id: `m${nextNumber++}`, name: memberName, paidCents: 0, owedCents: 0 }
    })

    if (members.length < 2) throw new ConvexError('A group needs at least two members.')
    if (members.length > MAX_MEMBERS) {
      throw new ConvexError(`A group can have up to ${MAX_MEMBERS} members.`)
    }
    if (new Set(members.map((m) => m.name.toLowerCase())).size !== members.length) {
      throw new ConvexError('Member names must be unique.')
    }

    await ctx.db.patch('groups', group._id, { name, currency: args.currency, members })
    return null
  },
})

/** Deletes a group and all of its expenses. */
export const remove = mutation({
  args: { groupId: v.id('groups') },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const group = await requireGroup(ctx, userId, args.groupId)
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
    for (const row of batch) await ctx.db.delete('groupExpenses', row._id)
    if (batch.length === 200) {
      await ctx.scheduler.runAfter(0, internal.groups.deleteExpenses, args)
    }
    return null
  },
})

export const addExpense = mutation({
  args: {
    groupId: v.id('groups'),
    description: v.string(),
    amountCents: v.number(),
    paidBy: v.string(),
    splitAmong: v.array(v.string()),
    category,
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const group = await requireGroup(ctx, userId, args.groupId)
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

    const expense = {
      groupId: group._id,
      description: input.text(args.description, 'Description', 80),
      amountCents: input.amount(args.amountCents),
      paidBy: args.paidBy,
      splitAmong,
      category: args.category,
      date: input.isoDate(args.date),
    }
    await ctx.db.insert('groupExpenses', expense)
    await ctx.db.patch('groups', group._id, {
      ...applyGroupExpense(group, expense, 1),
      lastExpenseAt: Date.now(),
    })
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
    return null
  },
})
