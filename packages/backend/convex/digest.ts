import { v } from 'convex/values'

import { formatMoney } from '@settlr/shared/format'
import type { Currency } from '@settlr/shared/schemas'
import { internal } from './_generated/api'
import { env, internalAction, internalMutation, internalQuery } from './_generated/server'
import { sendEmail } from './email'
import { myGroups, viewerMemberId } from './groups'
import { memberNet, myFriendShare, shares } from './lib/ledger'

// The weekly digest: what you spent in the last seven days and where your
// balances stand, emailed on Monday to everyone who turned it on in Settings.

export const sendAll = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query('profiles')
      .withIndex('by_weeklyDigest', (q) => q.eq('weeklyDigest', true))
      .paginate({ numItems: 50, cursor: args.cursor ?? null })
    // Spread the sends out a little.
    for (const [i, profile] of page.page.entries()) {
      await ctx.scheduler.runAfter(i * 1000, internal.digest.sendOne, { userId: profile.userId })
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(60_000, internal.digest.sendAll, {
        cursor: page.continueCursor,
      })
    }
    return null
  },
})

export const summary = internalQuery({
  args: { userId: v.string(), from: v.string(), to: v.string() },
  handler: async (ctx, { userId, from, to }) => {
    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique()
    if (!profile?.weeklyDigest || !profile.email) return null
    const spent = new Map<Currency, number>()
    const add = (c: Currency, cents: number) => spent.set(c, (spent.get(c) ?? 0) + cents)
    let count = 0
    const personal = await ctx.db
      .query('personalExpenses')
      .withIndex('by_userId_and_date', (q) => q.eq('userId', userId).gte('date', from).lte('date', to))
      .take(1000)
    for (const e of personal) {
      add(e.currency, e.amountCents)
      count++
    }
    const entries = await ctx.db
      .query('friendEntries')
      .withIndex('by_userId_and_date', (q) => q.eq('userId', userId).gte('date', from).lte('date', to))
      .take(1000)
    for (const e of entries) {
      if (e.kind !== 'expense') continue
      add(e.currency, myFriendShare(e))
      count++
    }
    const balances = new Map<Currency, number>()
    const addBalance = (c: Currency, cents: number) =>
      balances.set(c, (balances.get(c) ?? 0) + cents)
    for (const group of await myGroups(ctx, userId)) {
      const me = viewerMemberId(group, userId)
      if (!me) continue
      const order = group.members.map((m) => m.id)
      const expenses = await ctx.db
        .query('groupExpenses')
        .withIndex('by_groupId_and_date', (q) => q.eq('groupId', group._id).gte('date', from).lte('date', to))
        .take(500)
      for (const e of expenses) {
        const mine = shares(e, order).get(me)
        if (mine) {
          add(group.currency, mine)
          count++
        }
      }
      const member = group.members.find((m) => m.id === me)
      if (member) addBalance(group.currency, memberNet(member))
    }
    const friends = await ctx.db
      .query('friends')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .take(500)
    for (const f of friends) {
      for (const [c, cents] of Object.entries(f.balances)) addBalance(c as Currency, cents)
    }
    return {
      name: profile.name,
      email: profile.email,
      count,
      spent: [...spent].map(([currency, cents]) => ({ currency, cents })),
      balances: [...balances]
        .filter(([, cents]) => cents !== 0)
        .map(([currency, cents]) => ({ currency, cents })),
    }
  },
})

export const sendOne = internalAction({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const end = new Date()
    end.setUTCDate(end.getUTCDate() - 1)
    const start = new Date(end)
    start.setUTCDate(start.getUTCDate() - 6)
    const from = start.toISOString().slice(0, 10)
    const to = end.toISOString().slice(0, 10)
    const data = await ctx.runQuery(internal.digest.summary, { userId: args.userId, from, to })
    if (!data) return null
    const spentLine = data.spent.length
      ? data.spent.map((s) => formatMoney(s.cents, s.currency)).join(' + ')
      : 'nothing'
    const balanceLines = data.balances.length
      ? data.balances.map((b) =>
          b.cents > 0
            ? `You're owed ${formatMoney(b.cents, b.currency)}`
            : `You owe ${formatMoney(-b.cents, b.currency)}`,
        )
      : ['You’re all settled up.']
    const site = env.SITE_URL
    const text = `Hi ${data.name},\n\nLast week (${from} to ${to}) you spent ${spentLine} across ${data.count} expenses.\n\n${balanceLines.join('\n')}\n\nOpen Settlr: ${site}/dashboard\n\nTurn this email off in Settings.`
    const html = `<p>Hi ${data.name.replace(/[<>&]/g, '')},</p><p>Last week (${from} to ${to}) you spent <strong>${spentLine}</strong> across ${data.count} expenses.</p><ul>${balanceLines.map((l) => `<li>${l}</li>`).join('')}</ul><p><a href="${site}/dashboard">Open Settlr</a></p><p style="color:#888">Turn this email off in Settings.</p>`
    await sendEmail({ to: data.email, subject: 'Your week on Settlr', text, html })
    return null
  },
})
