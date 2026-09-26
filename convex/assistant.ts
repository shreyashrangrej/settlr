import { ConvexError, v } from 'convex/values'

import { formatMoney } from '../src/lib/format'
import type { Currency } from '../src/lib/schemas'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { action, env, internalQuery, query } from './_generated/server'
import { findGroup, myGroups, viewerMemberId } from './groups'
import {
  isToolName,
  runTool,
  toolDefinitions,
  type ChatEvent,
  type Context,
  type SearchResult,
} from './lib/assistantTools'
import { requireUser } from './lib/auth'
import {
  friendView,
  groupView,
  parseRef,
  personalView,
  type ExpenseView,
} from './lib/expenseView'
import * as input from './lib/input'
import { complete, type ChatMessage } from './lib/openrouter'
import { category, currency } from './lib/validators'

// The assistant (/assistant): people describe what they want in their own
// words ("Add tea personal expense 50", "What did I spend on food this
// month?", "Make yesterday's taxi 450") and an LLM on OpenRouter calls tools
// (convex/lib/assistantTools.ts) that add, find and edit expenses. Deleting
// is only offered: the user confirms it in the chat. The chat itself lives
// in the browser; each message sends the recent history along.

// Model calls per message: tool calls, their results, then the reply.
const MAX_ROUNDS = 5
const MAX_HISTORY = 12
const MAX_USER_MESSAGE = 500
const MAX_ASSISTANT_MESSAGE = 2000
const MAX_MEMO = 4000
const MAX_FRIENDS = 200
const MAX_GROUPS = 50
// A search reads at most this many rows from each kind of expense, and
// stops after this many matches.
const SCAN_LIMIT = 2000
const MAX_MATCHES = 1000

/** Whether the deployment has an OpenRouter key and model. */
export const status = query({
  args: {},
  handler: async () => ({
    configured: Boolean(env.OPENROUTER_API_KEY && env.OPENROUTER_MODEL),
  }),
})

/** The caller's friends and groups, for the model to pick from. */
export const context = internalQuery({
  args: {},
  handler: async (ctx): Promise<Context> => {
    const { userId, name } = await requireUser(ctx)
    const friends = await ctx.db
      .query('friends')
      .withIndex('by_userId_and_lastActivityAt', (q) => q.eq('userId', userId))
      .order('desc')
      .take(MAX_FRIENDS)
    const groups = (await myGroups(ctx, userId)).slice(0, MAX_GROUPS)
    return {
      name,
      friends: friends.map((f) => ({ id: f._id, name: f.name })),
      groups: groups.map((g) => ({
        id: g._id,
        name: g.name,
        currency: g.currency,
        meMemberId: viewerMemberId(g, userId) ?? g.meMemberId,
        members: g.members.map((m) => ({ id: m.id, name: m.name })),
      })),
    }
  },
})

// Lowercase words, for matching descriptions.
function words(text: string) {
  return text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)
}

/**
 * The caller's expenses that match every filter given, newest first, with
 * totals over all matches. Dates are inclusive `YYYY-MM-DD` strings; `text`
 * matches words in the description by prefix ("tea" finds "Tea break").
 */
export const search = internalQuery({
  args: {
    kind: v.optional(v.union(v.literal('personal'), v.literal('friend'), v.literal('group'))),
    friendId: v.optional(v.id('friends')),
    groupId: v.optional(v.id('groups')),
    text: v.optional(v.string()),
    category: v.optional(category),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
    minCents: v.optional(v.number()),
    maxCents: v.optional(v.number()),
    limit: v.number(),
  },
  handler: async (ctx, args): Promise<SearchResult> => {
    const { userId } = await requireUser(ctx)
    const from = args.from ? input.isoDate(args.from) : '0000-01-01'
    const to = args.to ? input.isoDate(args.to) : '9999-12-31'
    const needles = args.text ? words(args.text) : []
    const matches = (e: { description: string; category: string; amountCents: number }) => {
      if (args.category && e.category !== args.category) return false
      if (args.minCents !== undefined && e.amountCents < args.minCents) return false
      if (args.maxCents !== undefined && e.amountCents > args.maxCents) return false
      if (needles.length === 0) return true
      const have = words(e.description)
      return needles.every((n) => have.some((w) => w.startsWith(n)))
    }
    // A friend or group filter implies its kind.
    const kinds =
      args.friendId || args.groupId
        ? [...(args.friendId ? ['friend'] : []), ...(args.groupId ? ['group'] : [])]
        : args.kind
          ? [args.kind]
          : ['personal', 'friend', 'group']

    const found: Array<ExpenseView> = []
    let capped = false
    async function scan<T>(rows: AsyncIterable<T>, visit: (row: T) => void) {
      let read = 0
      for await (const row of rows) {
        if (++read > SCAN_LIMIT || found.length >= MAX_MATCHES) {
          capped = true
          break
        }
        visit(row)
      }
    }

    if (kinds.includes('personal')) {
      await scan(
        ctx.db
          .query('personalExpenses')
          .withIndex('by_userId_and_date', (q) =>
            q.eq('userId', userId).gte('date', from).lte('date', to),
          )
          .order('desc'),
        (e) => {
          if (matches(e)) found.push(personalView(e))
        },
      )
    }

    if (kinds.includes('friend')) {
      const friends = new Map(
        (
          await ctx.db
            .query('friends')
            .withIndex('by_userId', (q) => q.eq('userId', userId))
            .take(500)
        ).map((f) => [f._id, f]),
      )
      const friendId = args.friendId
      if (!friendId || friends.has(friendId)) {
        const rows = friendId
          ? ctx.db
              .query('friendEntries')
              .withIndex('by_friendId_and_date', (q) =>
                q.eq('friendId', friendId).gte('date', from).lte('date', to),
              )
          : ctx.db
              .query('friendEntries')
              .withIndex('by_userId_and_date', (q) =>
                q.eq('userId', userId).gte('date', from).lte('date', to),
              )
        await scan(rows.order('desc'), (e) => {
          const friend = friends.get(e.friendId)
          if (e.kind === 'expense' && e.userId === userId && friend && matches(e)) {
            found.push(friendView(e, friend))
          }
        })
      }
    }

    if (kinds.includes('group')) {
      const groups = args.groupId
        ? [await findGroup(ctx, userId, args.groupId)].filter((g) => g !== null)
        : await myGroups(ctx, userId)
      for (const group of groups) {
        const me = viewerMemberId(group, userId)
        if (!me) continue
        await scan(
          ctx.db
            .query('groupExpenses')
            .withIndex('by_groupId_and_date', (q) =>
              q.eq('groupId', group._id).gte('date', from).lte('date', to),
            )
            .order('desc'),
          (e) => {
            if (matches(e)) found.push(groupView(e, group, me))
          },
        )
      }
    }

    found.sort((a, b) => b.date.localeCompare(a.date))
    const totals = new Map<Currency, { cents: number; myShareCents: number }>()
    for (const e of found) {
      const row = totals.get(e.currency) ?? { cents: 0, myShareCents: 0 }
      row.cents += e.amountCents
      row.myShareCents += e.myShareCents
      totals.set(e.currency, row)
    }
    return {
      expenses: found.slice(0, input.listLimit(Math.min(args.limit, 50))),
      count: found.length,
      totals: [...totals]
        .map(([currency, row]) => ({ currency, ...row }))
        .sort((a, b) => b.cents - a.cents),
      capped,
    }
  },
})

/** One of the caller's expenses, with what editing it needs. */
export type ExpenseDetail =
  | {
      kind: 'personal'
      id: Id<'personalExpenses'>
      view: ExpenseView
      receiptId: Id<'receipts'> | null
    }
  | {
      kind: 'friend'
      id: Id<'friendEntries'>
      view: ExpenseView
      receiptId: Id<'receipts'> | null
      paidBy: 'me' | 'friend'
      split: 'equal' | 'full'
    }
  | {
      kind: 'group'
      id: Id<'groupExpenses'>
      view: ExpenseView
      receiptId: Id<'receipts'> | null
      paidBy: string
      splitAmong: Array<string>
      meMemberId: string
      members: Array<{ id: string; name: string }>
    }

/** An expense by its ref ("personal:<id>"), or null if it isn't the caller's. */
export const expense = internalQuery({
  args: { ref: v.string() },
  handler: async (ctx, args): Promise<ExpenseDetail | null> => {
    const { userId } = await requireUser(ctx)
    const ref = parseRef(args.ref)
    if (!ref) return null

    if (ref.kind === 'personal') {
      const id = ctx.db.normalizeId('personalExpenses', ref.id)
      const e = id ? await ctx.db.get('personalExpenses', id) : null
      if (!e || e.userId !== userId) return null
      return { kind: 'personal', id: e._id, view: personalView(e), receiptId: e.receiptId ?? null }
    }

    if (ref.kind === 'friend') {
      const id = ctx.db.normalizeId('friendEntries', ref.id)
      const e = id ? await ctx.db.get('friendEntries', id) : null
      if (!e || e.kind !== 'expense' || e.userId !== userId) return null
      const friend = await ctx.db.get('friends', e.friendId)
      if (!friend) return null
      return {
        kind: 'friend',
        id: e._id,
        view: friendView(e, friend),
        receiptId: e.receiptId ?? null,
        paidBy: e.paidBy,
        split: e.split,
      }
    }

    const id = ctx.db.normalizeId('groupExpenses', ref.id)
    const e = id ? await ctx.db.get('groupExpenses', id) : null
    const group = e ? await findGroup(ctx, userId, e.groupId) : null
    const me = group ? viewerMemberId(group, userId) : null
    if (!e || !group || !me) return null
    return {
      kind: 'group',
      id: e._id,
      view: groupView(e, group, me),
      receiptId: e.receiptId ?? null,
      paidBy: e.paidBy,
      splitAmong: e.splitAmong,
      meMemberId: me,
      members: group.members.map((m) => ({ id: m.id, name: m.name })),
    }
  },
})

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function systemPrompt(context: Context, today: string, defaultCurrency: Currency) {
  const weekday = WEEKDAYS[new Date(`${today}T00:00:00Z`).getUTCDay()]
  const friends = context.friends.length
    ? context.friends.map((f) => JSON.stringify(f.name)).join(', ')
    : '(none yet)'
  const groups = context.groups.length
    ? context.groups
        .map((g) => {
          const members = g.members.map((m) =>
            m.id === g.meMemberId ? 'the user' : JSON.stringify(m.name),
          )
          return `- ${JSON.stringify(g.name)} (${g.currency}): ${members.join(', ')}`
        })
        .join('\n')
    : '(none yet)'

  return `You are the assistant in Settlr, an app for tracking and splitting expenses. You add, find and change the user's expenses by calling tools.

Today is ${weekday}, ${today}. The user is ${JSON.stringify(context.name)}. Their default currency is ${defaultCurrency}.

Their friends: ${friends}

Their groups (currency, then members):
${groups}

Kinds of expense:
- Personal: spending that's just theirs. Use this when nobody else is involved.
- With a friend: a one-on-one expense with someone from the friends list. paid_by is "me" when the user paid and "friend" when the friend did. split is "equal" when they share it, "full" when the person who didn't pay owes all of it (e.g. "I paid for Sam's lunch" is paid_by "me", split "full").
- In a group: when the user names a group, or several people from one group. It's always in the group's currency.

Adding:
- Never guess an amount. If the amount is missing, or it's unclear who the expense is with, ask one short question instead of calling a tool.
- Pick the closest category: food (meals, snacks, tea, coffee, restaurants), groceries, transport (taxi, fuel, parking, trains, flights), lodging (hotels, rent), utilities (bills, phone, internet), entertainment (movies, events, subscriptions), other.
- One message can describe several expenses; add each of them.

Finding (search_expenses):
- Use it for any question about their expenses or spending: lists, totals, "how much did I spend on...". Turn periods into date_from/date_to ("this month" is from the 1st to today).
- "amount" is the whole expense; "your_share" is what it cost the user. When they ask what they spent, use your_share totals.
- The app shows the matching expenses under your reply, so answer in a sentence or two (how many, the totals) instead of listing them all.

Changing and deleting:
- You need the expense's ref: take it from earlier in the conversation, or call search_expenses first. If more than one expense fits and it's unclear which one they mean, ask. Never guess.
- update_expense changes it right away. delete_expense only offers it: tell the user to press Delete under your reply to confirm.
- You can't move an expense between personal, a friend and a group, change a group expense's currency, record settle-up payments or handle receipts; say those are done in the app.

Always:
- Only act on the latest message. Earlier messages were already handled; never repeat their changes.
- Work out relative dates ("yesterday", "last Friday") from today.
- Reply briefly with what you did or found. If a tool returned an error, explain it plainly and say what the user can do.
- Plain text only, no markdown.`
}

// A line per expense in this reply, sent back with it as history, so a
// follow-up ("make that 60") can name them by ref.
function memoOf(events: Array<ChatEvent>) {
  const seen = new Map<string, ExpenseView>()
  for (const event of events) {
    const list = event.type === 'found' ? event.expenses : [event.expense]
    for (const e of list) seen.set(e.ref, e)
  }
  return [...seen.values()]
    .slice(0, 40)
    .map(
      (e) =>
        `${e.ref} | ${e.description} | ${formatMoney(e.amountCents, e.currency)} | ${e.date} | ${e.with ?? 'personal'}`,
    )
    .join('\n')
    .slice(0, MAX_MEMO)
}

function summarize(events: Array<ChatEvent>) {
  const count = (type: ChatEvent['type']) => events.filter((e) => e.type === type).length
  const parts = [
    count('added') && `added ${count('added')}`,
    count('updated') && `updated ${count('updated')}`,
  ].filter(Boolean)
  return parts.length ? `Done: ${parts.join(', ')}.` : 'Done.'
}

/**
 * Handles the latest chat message: the model may add, find and change
 * expenses (as the caller) and replies. `today` and `currency` are the
 * viewer's local date and default currency. `memo` on an assistant message
 * is what that reply returned.
 */
export const send = action({
  args: {
    messages: v.array(
      v.object({
        role: v.union(v.literal('user'), v.literal('assistant')),
        content: v.string(),
        memo: v.optional(v.string()),
      }),
    ),
    today: v.string(),
    currency,
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ reply: string; events: Array<ChatEvent>; memo: string }> => {
    const context: Context = await ctx.runQuery(internal.assistant.context, {})
    const apiKey = env.OPENROUTER_API_KEY
    const model = env.OPENROUTER_MODEL
    if (!apiKey || !model) {
      throw new ConvexError('The assistant isn’t set up on this server yet.')
    }
    const today = input.isoDate(args.today)
    const history = args.messages.slice(-MAX_HISTORY)
    if (history.at(-1)?.role !== 'user') throw new ConvexError('Type a message.')
    const messages: Array<ChatMessage> = [
      { role: 'system', content: systemPrompt(context, today, args.currency) },
      ...history.map((m): ChatMessage => {
        if (m.role === 'user') {
          return { role: 'user', content: input.text(m.content, 'Message', MAX_USER_MESSAGE) }
        }
        const memo = m.memo?.slice(0, MAX_MEMO)
        return {
          role: 'assistant',
          content:
            m.content.slice(0, MAX_ASSISTANT_MESSAGE) +
            (memo ? `\n\n[Expenses in this reply, as ref | description | amount | date | with:\n${memo}]` : ''),
        }
      }),
    ]

    const events: Array<ChatEvent> = []
    let reply: string | null = null
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const { content, toolCalls } = await complete({
        apiKey,
        model,
        messages,
        tools: toolDefinitions,
      })
      if (toolCalls.length === 0) {
        reply = content
        break
      }
      messages.push({ role: 'assistant', content: content || null, tool_calls: toolCalls })
      for (const call of toolCalls) {
        let result: Record<string, unknown>
        if (!isToolName(call.function.name)) {
          result = { ok: false, error: `There’s no tool called ${call.function.name}.` }
        } else {
          try {
            const outcome = await runTool(
              ctx,
              context,
              { today, currency: args.currency },
              call.function.name,
              JSON.parse(call.function.arguments),
            )
            result = outcome.result
            events.push(...outcome.events)
          } catch (err) {
            // Mutations throw ConvexError for anything the user can fix.
            if (!(err instanceof ConvexError) && !(err instanceof SyntaxError)) {
              console.error('Assistant tool failed', err)
            }
            result = {
              ok: false,
              error:
                err instanceof ConvexError && typeof err.data === 'string'
                  ? err.data
                  : 'That didn’t work.',
            }
          }
        }
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) })
      }
    }

    // Searches made only to find something to change aren't worth showing.
    const changed = events.some((e) => e.type === 'updated' || e.type === 'delete')
    const shown = changed ? events.filter((e) => e.type !== 'found') : events
    return {
      reply:
        reply ||
        (events.length ? summarize(events) : 'Sorry, I couldn’t work that out. Try rephrasing it.'),
      events: shown,
      memo: memoOf(shown),
    }
  },
})
