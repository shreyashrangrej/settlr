import { ConvexError, v } from 'convex/values'

import type { Doc, Id } from './_generated/dataModel'
import { mutation } from './_generated/server'
import { MAX_GROUPS, MAX_MEMBERS, checkExpense } from './groups'
import { logActivity } from './lib/activity'
import { requireUser } from './lib/auth'
import * as input from './lib/input'
import { applyGroupExpense, applyGroupPayment } from './lib/ledger'
import { category, currency } from './lib/validators'

// Importing a group from a Splitwise CSV export. The browser parses the file
// (apps/web/src/lib/splitwise.ts) into members, expenses with exact shares,
// and payments; this checks everything and writes the group in one go.

const MAX_IMPORT = 1500

export const splitwise = mutation({
  args: {
    name: v.string(),
    currency,
    // Column order from the file; `me` is the index of the caller's column.
    members: v.array(v.string()),
    me: v.number(),
    expenses: v.array(
      v.object({
        description: v.string(),
        date: v.string(),
        category,
        amountCents: v.number(),
        paidBy: v.number(),
        // Cents each member owes, by column index.
        owed: v.array(v.number()),
      }),
    ),
    payments: v.array(
      v.object({ from: v.number(), to: v.number(), amountCents: v.number(), date: v.string() }),
    ),
  },
  handler: async (ctx, args): Promise<Id<'groups'>> => {
    const me = await requireUser(ctx)
    const name = input.text(args.name, 'Group name', 60)
    if (args.members.length < 2 || args.members.length > MAX_MEMBERS) {
      throw new ConvexError(`A group needs 2 to ${MAX_MEMBERS} members.`)
    }
    const owned = await ctx.db
      .query('groups')
      .withIndex('by_userId', (q) => q.eq('userId', me.userId))
      .take(MAX_GROUPS)
    if (owned.length >= MAX_GROUPS) {
      throw new ConvexError(`You can have up to ${MAX_GROUPS} groups.`)
    }
    if (args.expenses.length + args.payments.length > MAX_IMPORT) {
      throw new ConvexError(`That file has more than ${MAX_IMPORT} rows. Split it up first.`)
    }
    if (!Number.isInteger(args.me) || args.me < 0 || args.me >= args.members.length) {
      throw new ConvexError('Pick which person in the file is you.')
    }
    const names = args.members.map((m, i) =>
      i === args.me ? me.name : input.text(m, 'Member name', 40),
    )
    if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) {
      throw new ConvexError('Member names must be unique.')
    }
    // You're m1, like any group you create; the others follow in file order.
    const order = [args.me, ...names.map((_, i) => i).filter((i) => i !== args.me)]
    const idOf = new Map(order.map((col, n) => [col, `m${n + 1}`]))
    const members = order.map((col) => ({
      id: idOf.get(col)!,
      name: names[col],
      paidCents: 0,
      owedCents: 0,
    }))
    const groupId = await ctx.db.insert('groups', {
      userId: me.userId,
      name,
      currency: args.currency,
      members,
      meMemberId: 'm1',
      expenseCount: 0,
      totalCents: 0,
      byCategory: {},
      byMonth: {},
    })
    let group = (await ctx.db.get('groups', groupId))!
    const col = (i: number) => {
      const id = idOf.get(i)
      if (!id) throw new ConvexError('A row names someone who isn’t in the file.')
      return id
    }

    for (const row of args.expenses) {
      const inputs: Record<string, number> = {}
      row.owed.forEach((cents, i) => {
        if (cents > 0) inputs[col(i)] = cents
      })
      const expense = checkExpense(group, {
        description: row.description,
        amountCents: row.amountCents,
        paidBy: col(row.paidBy),
        splitAmong: Object.keys(inputs),
        category: row.category,
        date: row.date,
        split: { mode: 'exact', inputs },
        tags: ['splitwise'],
      })
      await ctx.db.insert('groupExpenses', expense)
      group = { ...group, ...applyGroupExpense(group, expense, 1) } as Doc<'groups'>
    }
    for (const row of args.payments) {
      const payment = {
        groupId,
        from: col(row.from),
        to: col(row.to),
        amountCents: input.amount(row.amountCents),
        date: input.isoDate(row.date),
        recordedBy: me.userId,
      }
      if (payment.from === payment.to) continue
      await ctx.db.insert('groupPayments', payment)
      group = { ...group, ...applyGroupPayment(group, payment, 1) } as Doc<'groups'>
    }
    const { _id, _creationTime, ...fields } = group
    void _id
    void _creationTime
    await ctx.db.replace('groups', groupId, {
      ...fields,
      lastExpenseAt: args.expenses.length ? Date.now() : undefined,
    })
    await logActivity(ctx, {
      groupId,
      actorName: me.name,
      kind: 'group_updated',
      description: `Imported ${args.expenses.length} expenses and ${args.payments.length} payments from Splitwise`,
    })
    return groupId
  },
})
