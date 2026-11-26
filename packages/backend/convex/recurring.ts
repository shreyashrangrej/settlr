import { ConvexError, v } from 'convex/values'

import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { internalMutation, mutation, query, type MutationCtx } from './_generated/server'
import { record, requireFriend, checkSplit } from './friends'
import { checkExpense, insertGroupExpense, requireGroup } from './groups'
import { requireUser } from './lib/auth'
import * as input from './lib/input'
import { category, currency, frequency } from './lib/validators'

// Recurring expenses (rent, subscriptions): a template that a daily cron
// turns into a real expense on each due date, as the person who set it up.

const MAX_RECURRING = 100
type Frequency = Doc<'recurring'>['frequency']

function daysIn(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** The due date after `date`, keeping the anchor day where the month has it. */
export function advance(date: string, freq: Frequency, anchorDay: number) {
  const [y, m, d] = date.split('-').map(Number)
  if (freq === 'weekly') {
    return new Date(Date.UTC(y, m - 1, d + 7)).toISOString().slice(0, 10)
  }
  const months = freq === 'monthly' ? 1 : 12
  const total = y * 12 + (m - 1) + months
  const year = Math.floor(total / 12)
  const month = (total % 12) + 1
  const day = Math.min(anchorDay, daysIn(year, month))
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10)
}

/** Your recurring expenses, soonest first, with what they're with. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireUser(ctx)
    const rows = await ctx.db
      .query('recurring')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .take(MAX_RECURRING)
    const out = []
    for (const r of rows) {
      let where: string | null = null
      let href = '/personal'
      if (r.friendId) {
        const friend = await ctx.db.get('friends', r.friendId)
        where = friend?.name ?? 'A removed friend'
        href = `/friends/${r.friendId}`
      } else if (r.groupId) {
        const group = await ctx.db.get('groups', r.groupId)
        where = group?.name ?? 'A deleted group'
        href = `/groups/${r.groupId}`
      }
      out.push({
        id: r._id,
        kind: r.kind,
        description: r.description,
        amountCents: r.amountCents,
        currency: r.currency,
        category: r.category,
        frequency: r.frequency,
        nextDate: r.nextDate,
        paused: r.paused,
        where,
        href,
      })
    }
    return out.sort((a, b) => a.nextDate.localeCompare(b.nextDate))
  },
})

/** What's due from `today` up to `days` ahead (the dashboard's Upcoming bills). */
export const upcoming = query({
  args: { today: v.string(), days: v.number() },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const today = input.isoDate(args.today)
    const until = new Date(`${today}T00:00:00Z`)
    until.setUTCDate(until.getUTCDate() + Math.min(Math.max(args.days, 1), 90))
    const end = until.toISOString().slice(0, 10)
    const rows = await ctx.db
      .query('recurring')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .take(MAX_RECURRING)
    return rows
      .filter((r) => !r.paused && r.nextDate <= end)
      .sort((a, b) => a.nextDate.localeCompare(b.nextDate))
      .map((r) => ({
        id: r._id,
        description: r.description,
        amountCents: r.amountCents,
        currency: r.currency,
        category: r.category,
        nextDate: r.nextDate,
        frequency: r.frequency,
      }))
  },
})

export const create = mutation({
  args: {
    kind: v.union(v.literal('personal'), v.literal('friend'), v.literal('group')),
    friendId: v.optional(v.id('friends')),
    groupId: v.optional(v.id('groups')),
    description: v.string(),
    amountCents: v.number(),
    currency,
    category,
    paidBy: v.optional(v.string()),
    split: v.optional(v.union(v.literal('equal'), v.literal('full'))),
    splitAmong: v.optional(v.array(v.string())),
    frequency,
    startDate: v.string(),
  },
  handler: async (ctx, args): Promise<Id<'recurring'>> => {
    const me = await requireUser(ctx)
    const existing = await ctx.db
      .query('recurring')
      .withIndex('by_userId', (q) => q.eq('userId', me.userId))
      .take(MAX_RECURRING)
    if (existing.length >= MAX_RECURRING) {
      throw new ConvexError(`You can have up to ${MAX_RECURRING} recurring expenses.`)
    }
    const startDate = input.isoDate(args.startDate)
    const base = {
      userId: me.userId,
      userName: me.name,
      kind: args.kind,
      description: input.text(args.description, 'Description', 80),
      amountCents: input.amount(args.amountCents),
      currency: args.currency,
      category: args.category,
      frequency: args.frequency,
      anchorDay: Number(startDate.slice(8, 10)),
      nextDate: startDate,
      paused: false,
    }
    let row: Omit<Doc<'recurring'>, '_id' | '_creationTime'>
    if (args.kind === 'personal') {
      row = base
    } else if (args.kind === 'friend') {
      if (!args.friendId) throw new ConvexError('Pick a friend.')
      const friend = await requireFriend(ctx, me.userId, args.friendId)
      if (args.paidBy !== 'me' && args.paidBy !== 'friend') {
        throw new ConvexError('Say who pays it.')
      }
      row = { ...base, friendId: friend._id, paidBy: args.paidBy, split: args.split ?? 'equal' }
    } else {
      if (!args.groupId) throw new ConvexError('Pick a group.')
      const group = await requireGroup(ctx, me.userId, args.groupId)
      const checked = checkExpense(group, {
        description: base.description,
        amountCents: base.amountCents,
        paidBy: args.paidBy ?? '',
        splitAmong: args.splitAmong ?? group.members.map((m) => m.id),
        category: args.category,
        date: startDate,
      })
      row = {
        ...base,
        currency: group.currency,
        groupId: group._id,
        paidBy: checked.paidBy,
        splitAmong: checked.splitAmong,
      }
    }
    const id = await ctx.db.insert('recurring', row)
    // If it's due today (or earlier), add it now rather than tomorrow.
    if (startDate <= todayUtc()) {
      await ctx.scheduler.runAfter(0, internal.recurring.processDue, {})
    }
    return id
  },
})

export const setPaused = mutation({
  args: { recurringId: v.id('recurring'), paused: v.boolean() },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const row = await ctx.db.get('recurring', args.recurringId)
    if (!row || row.userId !== userId) throw new ConvexError('That recurring expense is gone.')
    let nextDate = row.nextDate
    // Resuming skips the dates missed while paused.
    if (!args.paused) {
      const today = todayUtc()
      while (nextDate < today) nextDate = advance(nextDate, row.frequency, row.anchorDay)
    }
    await ctx.db.patch('recurring', row._id, { paused: args.paused, nextDate })
    return null
  },
})

export const remove = mutation({
  args: { recurringId: v.id('recurring') },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const row = await ctx.db.get('recurring', args.recurringId)
    if (!row || row.userId !== userId) return null
    await ctx.db.delete('recurring', row._id)
    return null
  },
})

// Adds one occurrence. Returns false when its friend or group is gone.
async function addOccurrence(ctx: MutationCtx, row: Doc<'recurring'>, date: string) {
  const me = { userId: row.userId, name: row.userName, email: '' }
  const common = {
    description: row.description,
    amountCents: row.amountCents,
    category: row.category,
    date,
    recurringId: row._id,
  }
  if (row.kind === 'personal') {
    await ctx.db.insert('personalExpenses', {
      userId: row.userId,
      currency: row.currency,
      ...common,
    })
    return true
  }
  if (row.kind === 'friend') {
    const friend = row.friendId
      ? await requireFriend(ctx, row.userId, row.friendId).catch(() => null)
      : null
    if (!friend) return false
    await record(ctx, me, friend, {
      kind: 'expense',
      userId: row.userId,
      friendId: friend._id,
      currency: row.currency,
      paidBy: row.paidBy === 'friend' ? 'friend' : 'me',
      ...common,
      ...checkSplit({ amountCents: row.amountCents, split: row.split ?? 'equal' }),
    })
    return true
  }
  const group = row.groupId
    ? await requireGroup(ctx, row.userId, row.groupId).catch(() => null)
    : null
  if (!group) return false
  const ids = new Set(group.members.map((m) => m.id))
  const splitAmong = (row.splitAmong ?? []).filter((id) => ids.has(id))
  if (!row.paidBy || !ids.has(row.paidBy) || splitAmong.length === 0) return false
  const checked = checkExpense(group, { ...common, paidBy: row.paidBy, splitAmong })
  await insertGroupExpense(ctx, me, group, { ...checked, recurringId: row._id })
  return true
}

/** Adds every recurring expense that's due (the daily cron, and after create). */
export const processDue = internalMutation({
  args: {},
  handler: async (ctx) => {
    const today = todayUtc()
    const due = await ctx.db
      .query('recurring')
      .withIndex('by_paused_and_nextDate', (q) => q.eq('paused', false).lte('nextDate', today))
      .take(50)
    for (const row of due) {
      let next = row.nextDate
      let ok = true
      // Catch up on anything missed, at most a year of weekly ones.
      for (let i = 0; i < 53 && next <= today && ok; i++) {
        ok = await addOccurrence(ctx, row, next)
        if (ok) next = advance(next, row.frequency, row.anchorDay)
      }
      await ctx.db.patch('recurring', row._id, ok ? { nextDate: next } : { paused: true })
    }
    if (due.length === 50) await ctx.scheduler.runAfter(0, internal.recurring.processDue, {})
    return null
  },
})
