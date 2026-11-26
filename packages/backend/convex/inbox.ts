import { ConvexError, v } from 'convex/values'

import { internal } from './_generated/api'
import {
  httpAction,
  internalAction,
  internalMutation,
  mutation,
  query,
  env,
} from './_generated/server'
import { requireUser } from './lib/auth'
import { extractExpense } from './lib/extract'
import * as input from './lib/input'
import { category, currency } from './lib/validators'

// The email inbox: people forward receipts and bills to their own address
// (<token>@INBOUND_EMAIL_DOMAIN, from Settings). The email provider posts
// each one to /inbound-email; it's read into a draft expense that waits on
// the Inbox page until they add or dismiss it.

const MAX_TEXT = 6000

function pick(body: unknown): { to: Array<string>; from: string; subject: string; text: string } | null {
  if (typeof body !== 'object' || body === null) return null
  const root = body as Record<string, unknown>
  // Resend's webhook wraps the email in `data`; others post it flat.
  const mail = (typeof root.data === 'object' && root.data !== null ? root.data : root) as Record<
    string,
    unknown
  >
  const list = (value: unknown) =>
    (Array.isArray(value) ? value : [value])
      .map((x) => (typeof x === 'string' ? x : typeof x === 'object' && x && 'email' in x ? String((x as { email: unknown }).email) : ''))
      .filter(Boolean)
  const html = typeof mail.html === 'string' ? mail.html.replace(/<[^>]+>/g, ' ') : ''
  const text = typeof mail.text === 'string' && mail.text.trim() ? mail.text : html
  const to = list(mail.to)
  if (to.length === 0) return null
  return {
    to,
    from: list(mail.from)[0] ?? '',
    subject: typeof mail.subject === 'string' ? mail.subject : '',
    text,
  }
}

export const receiveHttp = httpAction(async (ctx, request) => {
  const secret = env.INBOUND_EMAIL_SECRET
  const domain = env.INBOUND_EMAIL_DOMAIN?.toLowerCase()
  if (!secret || !domain) return new Response('Inbox is off', { status: 404 })
  if (request.headers.get('x-inbound-secret') !== secret) {
    return new Response('Unauthorized', { status: 401 })
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response('Expected JSON', { status: 400 })
  }
  const mail = pick(body)
  if (!mail) return new Response('No recipient', { status: 400 })
  for (const address of mail.to) {
    const match = /<?([^<>\s]+)@([^<>\s]+)>?$/.exec(address.trim().toLowerCase())
    if (!match || match[2] !== domain) continue
    const token = match[1].split('+')[0]
    await ctx.runMutation(internal.inbox.receive, {
      token,
      from: mail.from.slice(0, 200),
      subject: mail.subject.slice(0, 200),
      text: mail.text.slice(0, MAX_TEXT),
    })
  }
  return new Response('OK', { status: 200 })
})

export const receive = internalMutation({
  args: { token: v.string(), from: v.string(), subject: v.string(), text: v.string() },
  handler: async (ctx, args) => {
    if (!/^[0-9a-f]{16}$/.test(args.token)) return null
    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_inboxToken', (q) => q.eq('inboxToken', args.token))
      .unique()
    if (!profile) return null
    const pending = await ctx.db
      .query('inboxItems')
      .withIndex('by_userId_and_status', (q) => q.eq('userId', profile.userId).eq('status', 'new'))
      .take(101)
    // Don't let a flood of mail pile up.
    if (pending.length > 100) return null
    const id = await ctx.db.insert('inboxItems', {
      userId: profile.userId,
      from: args.from,
      subject: args.subject,
      snippet: args.text.replace(/\s+/g, ' ').trim().slice(0, 300),
      status: 'new',
    })
    await ctx.scheduler.runAfter(0, internal.inbox.read, { itemId: id, ...args })
    return null
  },
})

// Fallback when no model is configured: the largest amount-looking number.
function guessAmount(text: string) {
  const amounts = [...text.matchAll(/(?:₹|rs\.?|inr|\$|€|£|usd|eur|gbp)\s?([\d,]+(?:\.\d{1,2})?)/gi)]
    .map((m) => Number(m[1].replace(/,/g, '')))
    .filter((n) => Number.isFinite(n) && n > 0 && n < 1_000_000)
  return amounts.length ? Math.round(Math.max(...amounts) * 100) : undefined
}

export const read = internalAction({
  args: {
    itemId: v.id('inboxItems'),
    token: v.string(),
    from: v.string(),
    subject: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    let draft: {
      description: string
      amountCents?: number
      currency?: typeof currency.type
      category?: typeof category.type
      date?: string
    }
    try {
      draft = await extractExpense(
        `From: ${args.from}\nSubject: ${args.subject}\n\n${args.text}`,
        { vision: false },
      )
    } catch {
      draft = {
        description: args.subject.replace(/^(fwd?|re):\s*/i, '').slice(0, 80) || 'Forwarded email',
        amountCents: guessAmount(`${args.subject}\n${args.text}`),
      }
    }
    await ctx.runMutation(internal.inbox.setDraft, { itemId: args.itemId, draft })
    return null
  },
})

export const setDraft = internalMutation({
  args: {
    itemId: v.id('inboxItems'),
    draft: v.object({
      description: v.string(),
      amountCents: v.optional(v.number()),
      currency: v.optional(currency),
      category: v.optional(category),
      date: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get('inboxItems', args.itemId)
    if (item) await ctx.db.patch('inboxItems', item._id, { draft: args.draft })
    return null
  },
})

/** Forwarded emails waiting for you, newest first. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireUser(ctx)
    const rows = await ctx.db
      .query('inboxItems')
      .withIndex('by_userId_and_status', (q) => q.eq('userId', userId).eq('status', 'new'))
      .order('desc')
      .take(100)
    return rows.map((r) => ({
      id: r._id,
      receivedAt: r._creationTime,
      from: r.from,
      subject: r.subject,
      snippet: r.snippet,
      draft: r.draft ?? null,
    }))
  },
})

async function requireItem(ctx: Parameters<typeof requireUser>[0], itemId: string) {
  const { userId } = await requireUser(ctx)
  const id = ctx.db.normalizeId('inboxItems', itemId)
  const item = id ? await ctx.db.get('inboxItems', id) : null
  if (!item || item.userId !== userId || item.status !== 'new') {
    throw new ConvexError('That email has already been handled.')
  }
  return item
}

/** Adds the (edited) draft as a personal expense. */
export const accept = mutation({
  args: {
    itemId: v.id('inboxItems'),
    description: v.string(),
    amountCents: v.number(),
    currency,
    category,
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const item = await requireItem(ctx, args.itemId)
    await ctx.db.insert('personalExpenses', {
      userId: item.userId,
      description: input.text(args.description, 'Description', 80),
      amountCents: input.amount(args.amountCents),
      currency: args.currency,
      category: args.category,
      date: input.isoDate(args.date),
      tags: ['email'],
    })
    await ctx.db.patch('inboxItems', item._id, { status: 'added' })
    return null
  },
})

export const dismiss = mutation({
  args: { itemId: v.id('inboxItems') },
  handler: async (ctx, args) => {
    const item = await requireItem(ctx, args.itemId)
    await ctx.db.patch('inboxItems', item._id, { status: 'dismissed' })
    return null
  },
})
