import { ConvexError, v } from 'convex/values'

import { action } from './_generated/server'
import { currency } from './lib/validators'

// Exchange rates for expenses paid in another currency than the group's,
// from the European Central Bank's reference rates (frankfurter.app, no key
// needed). The rate is a suggestion; the form lets people change it.

export const rate = action({
  args: { from: currency, to: currency, date: v.string() },
  handler: async (ctx, args): Promise<{ rate: number; date: string }> => {
    if (!(await ctx.auth.getUserIdentity())) throw new ConvexError('Sign in to continue.')
    if (args.from === args.to) return { rate: 1, date: args.date }
    const day = /^\d{4}-\d{2}-\d{2}$/.test(args.date) ? args.date : 'latest'
    const url = `https://api.frankfurter.app/${day}?from=${args.from}&to=${args.to}`
    let body: { rates?: Record<string, number>; date?: string }
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(String(response.status))
      body = (await response.json()) as typeof body
    } catch {
      throw new ConvexError('Couldn’t get an exchange rate. Type one in.')
    }
    const value = body.rates?.[args.to]
    if (typeof value !== 'number') throw new ConvexError('No rate for that currency. Type one in.')
    return { rate: value, date: body.date ?? args.date }
  },
})
