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
