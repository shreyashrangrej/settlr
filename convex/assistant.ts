import { ConvexError, v } from 'convex/values'
import { z } from 'zod'

import { formatMoney } from '../src/lib/format'
import { CATEGORIES, CURRENCIES, type Category, type Currency } from '../src/lib/schemas'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { action, env, internalQuery, query, type ActionCtx } from './_generated/server'
import { myGroups, viewerMemberId } from './groups'
import { requireUser } from './lib/auth'
import * as input from './lib/input'
import { currency } from './lib/validators'

// The assistant (/assistant): people describe expenses in their own words
// ("Add tea personal expense 50") and an LLM on OpenRouter turns that into
// calls to the same mutations the forms use, so every value and ownership
// check still applies. The chat itself lives in the browser; each message
// sends the recent history along.

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
// Model calls per message: tool calls, their results, then the reply.
const MAX_ROUNDS = 4
const MAX_HISTORY = 12
const MAX_USER_MESSAGE = 500
const MAX_ASSISTANT_MESSAGE = 2000
const MAX_FRIENDS = 200
const MAX_GROUPS = 50
const TIMEOUT_MS = 45_000

/** Whether the deployment has an OpenRouter key and model. */
export const status = query({
  args: {},
  handler: async () => ({
    configured: Boolean(env.OPENROUTER_API_KEY && env.OPENROUTER_MODEL),
  }),
})

type Context = {
  name: string
  friends: Array<{ id: Id<'friends'>; name: string }>
  groups: Array<{
    id: Id<'groups'>
    name: string
    currency: Currency
    meMemberId: string
    members: Array<{ id: string; name: string }>
  }>
}

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

/** An expense the assistant added, for the chat to show and link to. */
export type AddedExpense = {
  kind: 'personal' | 'friend' | 'group'
  description: string
  amountCents: number
  currency: Currency
  category: Category
  date: string
  // The friend's or group's name.
  with: string | null
  href: string
}

// --- Tools ------------------------------------------------------------------
// Each tool's arguments are a zod schema: it validates what the model sends
// and, as JSON Schema, tells the model what to send.

const fields = {
  description: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .describe('Short and capitalised, without the amount, e.g. "Tea" or "Dinner at Luigi’s"'),
  amount: z
    .number()
    .positive()
    .max(1_000_000)
    .describe('In the main unit of the currency, e.g. 12.5 for 12.50'),
  currency: z
    .enum(CURRENCIES)
    .optional()
    .describe('Only if the user names a currency; leave out for their default'),
  category: z.enum(CATEGORIES),
  // A plain string keeps the schema short; the mutations check the date.
  date: z
    .string()
    .optional()
    .describe('YYYY-MM-DD, only if the user gives a date; leave out for today'),
}

const tools = {
  add_personal_expense: {
    description: 'Record spending that is just the user’s, not shared with anyone.',
    args: z.object(fields),
  },
  add_friend_expense: {
    description: 'Record a one-on-one expense shared with one friend.',
    args: z.object({
      friend: z.string().describe('The friend’s name, from the list of friends'),
      ...fields,
      paid_by: z
        .enum(['me', 'friend'])
        .optional()
        .describe('Who paid: "me" (the user, the default) or "friend"'),
      split: z
        .enum(['equal', 'full'])
        .optional()
        .describe(
          '"equal" (the default): each owes half. "full": the person who didn’t pay owes all of it',
        ),
    }),
  },
  add_group_expense: {
    description: 'Record an expense in a group, in the group’s currency.',
    args: z.object({
      group: z.string().describe('The group’s name, from the list of groups'),
      description: fields.description,
      amount: fields.amount,
      category: fields.category,
      date: fields.date,
      paid_by: z
        .string()
        .optional()
        .describe('The name of the member who paid; leave out if the user paid'),
      split_among: z
        .array(z.string())
        .optional()
        .describe('Names of the members sharing it equally; leave out for everyone'),
    }),
  },
}
type ToolName = keyof typeof tools

const toolDefinitions = Object.entries(tools).map(([name, tool]) => {
  const { $schema: _, ...parameters } = z.toJSONSchema(tool.args)
  return {
    type: 'function' as const,
    function: { name, description: tool.description, parameters },
  }
})

// Finds someone or something the model named: an exact (case-insensitive)
// match, else a single one whose name starts with it or has it as a word.
// Otherwise says what went wrong, for the model to pass on.
function findByName<T extends { name: string }>(
  items: Array<T>,
  name: string,
  what: string,
): T | string {
  const needle = name.trim().toLowerCase()
  const exact = items.filter((item) => item.name.toLowerCase() === needle)
  if (exact.length === 1) return exact[0]
  const close = items.filter((item) => {
    const lower = item.name.toLowerCase()
    return lower.startsWith(needle) || lower.split(/\s+/).includes(needle)
  })
  if (close.length === 1) return close[0]
  if (close.length > 1) {
    return `“${name}” could be ${close.map((item) => item.name).join(' or ')}. Ask which one.`
  }
  return `There’s no ${what} called “${name}”.`
}

type ToolResult = { ok: true; added: AddedExpense } | { ok: false; error: string }

async function runTool(
  ctx: ActionCtx,
  context: Context,
  defaults: { today: string; currency: Currency },
  name: ToolName,
  rawArgs: unknown,
): Promise<ToolResult> {
  const fail = (error: string): ToolResult => ({ ok: false, error })

  if (name === 'add_personal_expense') {
    const parsed = tools[name].args.safeParse(rawArgs)
    if (!parsed.success) return fail(z.prettifyError(parsed.error))
    const a = parsed.data
    const expense = {
      description: a.description,
      amountCents: Math.round(a.amount * 100),
      currency: a.currency ?? defaults.currency,
      category: a.category,
      date: a.date ?? defaults.today,
    }
    await ctx.runMutation(api.personal.add, expense)
    return {
      ok: true,
      added: {
        kind: 'personal',
        ...expense,
        with: null,
        href: `/personal?month=${expense.date.slice(0, 7)}`,
      },
    }
  }

  if (name === 'add_friend_expense') {
    const parsed = tools[name].args.safeParse(rawArgs)
    if (!parsed.success) return fail(z.prettifyError(parsed.error))
    const a = parsed.data
    const friend = findByName(context.friends, a.friend, 'friend')
    if (typeof friend === 'string') return fail(friend)
    const expense = {
      description: a.description,
      amountCents: Math.round(a.amount * 100),
      currency: a.currency ?? defaults.currency,
      category: a.category,
      date: a.date ?? defaults.today,
    }
    await ctx.runMutation(api.friends.addExpense, {
      friendId: friend.id,
      ...expense,
      paidBy: a.paid_by ?? 'me',
      split: a.split ?? 'equal',
    })
    return {
      ok: true,
      added: { kind: 'friend', ...expense, with: friend.name, href: `/friends/${friend.id}` },
    }
  }

  const parsed = tools.add_group_expense.args.safeParse(rawArgs)
  if (!parsed.success) return fail(z.prettifyError(parsed.error))
  const a = parsed.data
  const group = findByName(context.groups, a.group, 'group')
  if (typeof group === 'string') return fail(group)
  // "me", "I" or the user's own name mean their member.
  const member = (who: string) => {
    const lower = who.trim().toLowerCase()
    if (['me', 'i', 'myself', 'you', context.name.toLowerCase()].includes(lower)) {
      return group.members.find((m) => m.id === group.meMemberId)!
    }
    return findByName(group.members, who, `member of ${group.name}`)
  }
  const payer = a.paid_by ? member(a.paid_by) : member('me')
  if (typeof payer === 'string') return fail(payer)
  const sharers = (a.split_among ?? []).map(member)
  const unknown = sharers.find((m) => typeof m === 'string')
  if (unknown) return fail(unknown)
  const splitAmong = sharers.length
    ? sharers.map((m) => (m as { id: string }).id)
    : group.members.map((m) => m.id)
  const expense = {
    description: a.description,
    amountCents: Math.round(a.amount * 100),
    category: a.category,
    date: a.date ?? defaults.today,
  }
  await ctx.runMutation(api.groups.addExpense, {
    groupId: group.id,
    ...expense,
    paidBy: payer.id,
    splitAmong,
  })
  return {
    ok: true,
    added: {
      kind: 'group',
      ...expense,
      currency: group.currency,
      with: group.name,
      href: `/groups/${group.id}`,
    },
  }
}

// --- The model --------------------------------------------------------------

type ToolCall = {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}
type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: Array<ToolCall> }
  | { role: 'tool'; tool_call_id: string; content: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function unavailable(): never {
  throw new ConvexError('The assistant is unavailable right now. Try again in a moment.')
}

// One chat completion: the model's text and any tool calls it made.
async function complete(apiKey: string, model: string, messages: Array<ChatMessage>) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        // Optional attribution for OpenRouter's app rankings.
        'HTTP-Referer': env.SITE_URL,
        'X-Title': 'Settlr',
      },
      body: JSON.stringify({
        model,
        messages,
        tools: toolDefinitions,
        tool_choice: 'auto',
        temperature: 0.2,
        max_tokens: 1000,
      }),
      signal: controller.signal,
    })
  } catch (err) {
    console.error('OpenRouter request failed', err)
    unavailable()
  } finally {
    clearTimeout(timer)
  }
  if (!response.ok) {
    console.error(`OpenRouter responded ${response.status}`, await response.text())
    unavailable()
  }

  const body: unknown = await response.json()
  const choice = isRecord(body) && Array.isArray(body.choices) ? body.choices[0] : null
  const message = isRecord(choice) && isRecord(choice.message) ? choice.message : null
  if (!message) {
    console.error('Unexpected OpenRouter response', body)
    unavailable()
  }
  const toolCalls: Array<ToolCall> = []
  if (Array.isArray(message.tool_calls)) {
    for (const call of message.tool_calls) {
      if (
        isRecord(call) &&
        typeof call.id === 'string' &&
        isRecord(call.function) &&
        typeof call.function.name === 'string'
      ) {
        toolCalls.push({
          id: call.id,
          type: 'function',
          function: {
            name: call.function.name,
            arguments:
              typeof call.function.arguments === 'string' ? call.function.arguments : '{}',
          },
        })
      }
    }
  }
  return {
    content: typeof message.content === 'string' ? message.content.trim() : '',
    toolCalls,
  }
}

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

  return `You are the assistant in Settlr, an app for tracking and splitting expenses. You record the expenses the user describes by calling tools.

Today is ${weekday}, ${today}. The user is ${JSON.stringify(context.name)}. Their default currency is ${defaultCurrency}.

Their friends: ${friends}

Their groups (currency, then members):
${groups}

How to record an expense:
- Personal (add_personal_expense): spending that's just theirs. Use this when nobody else is involved.
- With a friend (add_friend_expense): a one-on-one expense with someone from the friends list. paid_by is "me" when the user paid and "friend" when the friend did. split is "equal" when they share it, "full" when the person who didn't pay owes all of it (e.g. "I paid for Sam's lunch" is paid_by "me", split "full").
- In a group (add_group_expense): when the user names a group, or several people from one group. It's always in the group's currency.

Rules:
- Only act on the latest message. Earlier messages were already handled; never add their expenses again.
- Never guess an amount. If the amount is missing, or it's unclear who the expense is with, ask one short question instead of calling a tool.
- Pick the closest category: food (meals, snacks, tea, coffee, restaurants), groceries, transport (taxi, fuel, parking, trains, flights), lodging (hotels, rent), utilities (bills, phone, internet), entertainment (movies, events, subscriptions), other.
- Work out relative dates ("yesterday", "last Friday") from today.
- One message can describe several expenses; add each of them.
- You can only add expenses. For anything else (editing, deleting, balances, settling up), say it can be done on the matching page of the app.
- After adding, reply in one or two short sentences saying what was added and where. If a tool returned an error, explain it plainly and say what the user can do.
- Plain text only, no markdown.`
}

function summarize(added: Array<AddedExpense>) {
  return `Added ${added
    .map(
      (e) =>
        `${e.description} (${formatMoney(e.amountCents, e.currency)}${e.with ? `, ${e.with}` : ''})`,
    )
    .join(', ')}.`
}

/**
 * Handles the latest chat message: the model may add expenses (as the
 * caller) and replies. `today` and `currency` are the viewer's local date
 * and default currency.
 */
export const send = action({
  args: {
    messages: v.array(
      v.object({
        role: v.union(v.literal('user'), v.literal('assistant')),
        content: v.string(),
      }),
    ),
    today: v.string(),
    currency,
  },
  handler: async (ctx, args): Promise<{ reply: string; added: Array<AddedExpense> }> => {
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
      ...history.map((m) =>
        m.role === 'user'
          ? { role: 'user' as const, content: input.text(m.content, 'Message', MAX_USER_MESSAGE) }
          : { role: 'assistant' as const, content: m.content.slice(0, MAX_ASSISTANT_MESSAGE) },
      ),
    ]

    const added: Array<AddedExpense> = []
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const { content, toolCalls } = await complete(apiKey, model, messages)
      if (toolCalls.length === 0) {
        return { reply: content || (added.length ? summarize(added) : 'Done.'), added }
      }
      messages.push({ role: 'assistant', content: content || null, tool_calls: toolCalls })
      for (const call of toolCalls) {
        let result: ToolResult
        if (!(call.function.name in tools)) {
          result = { ok: false, error: `There’s no tool called ${call.function.name}.` }
        } else {
          try {
            result = await runTool(
              ctx,
              context,
              { today, currency: args.currency },
              call.function.name as ToolName,
              JSON.parse(call.function.arguments),
            )
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
        if (result.ok) added.push(result.added)
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) })
      }
    }
    // Out of rounds: say what did happen.
    return {
      reply: added.length ? summarize(added) : 'Sorry, I couldn’t work that out. Try rephrasing it.',
      added,
    }
  },
})
