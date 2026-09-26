import { ConvexError } from 'convex/values'
import { z } from 'zod'

import { formatMoney } from '../../src/lib/format'
import { CATEGORIES, CURRENCIES, type Currency } from '../../src/lib/schemas'
import { api, internal } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import type { ActionCtx } from '../_generated/server'
import type { ExpenseView } from './expenseView'
import type { ToolDefinition } from './openrouter'

// The assistant's tools. Each one's arguments are a zod schema: it validates
// what the model sends and, as JSON Schema, tells the model what to send.
// Writes go through the same public mutations as the forms (as the caller),
// and reads through the internal queries in convex/assistant.ts, so the
// assistant can do nothing the user couldn't do in the app.

/** The caller's friends and groups, for the model to pick from. */
export type Context = {
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

export type Totals = Array<{ currency: Currency; cents: number; myShareCents: number }>

export type SearchResult = {
  expenses: Array<ExpenseView>
  // Every match, of which `expenses` are the newest.
  count: number
  totals: Totals
  // The search stopped early; there may be more matches.
  capped: boolean
}

/** What happened, for the chat to show under the reply. */
export type ChatEvent =
  | { type: 'added'; expense: ExpenseView }
  | { type: 'updated'; expense: ExpenseView; before: ExpenseView }
  | { type: 'found'; expenses: Array<ExpenseView>; count: number; totals: Totals; capped: boolean }
  // Proposed by the model; the user confirms it in the chat.
  | { type: 'delete'; expense: ExpenseView }

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
  // Plain strings keep the schema short; the functions check dates.
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
  search_expenses: {
    description:
      'Find the user’s expenses (personal, with friends and in groups), newest first, with totals over every match. Use it to answer questions about their spending, and to find an expense before changing or deleting it.',
    args: z.object({
      kind: z
        .enum(['personal', 'friend', 'group'])
        .optional()
        .describe('Only this kind of expense; leave out for all'),
      friend: z.string().optional().describe('Only expenses with this friend'),
      group: z.string().optional().describe('Only expenses in this group'),
      text: z.string().optional().describe('Words in the description, e.g. "tea"'),
      category: z.enum(CATEGORIES).optional(),
      date_from: z.string().optional().describe('YYYY-MM-DD, inclusive'),
      date_to: z.string().optional().describe('YYYY-MM-DD, inclusive'),
      min_amount: z.number().optional(),
      max_amount: z.number().optional(),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe('How many to list (default 20, at most 50). Totals cover every match'),
    }),
  },
  update_expense: {
    description:
      'Change an expense, given its ref from search_expenses or from earlier in the conversation. Pass only what changes.',
    args: z.object({
      ref: z.string().describe('The expense’s ref, e.g. "personal:abc123"'),
      description: fields.description.optional(),
      amount: fields.amount.optional(),
      currency: z
        .enum(CURRENCIES)
        .optional()
        .describe('Personal and friend expenses only; group expenses use the group’s'),
      category: fields.category.optional(),
      date: z.string().optional().describe('YYYY-MM-DD'),
      paid_by: z
        .string()
        .optional()
        .describe('Friend expense: "me" or "friend". Group expense: the member’s name, or "me"'),
      split: z.enum(['equal', 'full']).optional().describe('Friend expenses only'),
      split_among: z
        .array(z.string())
        .optional()
        .describe('Group expenses only: names of the members sharing it'),
    }),
  },
  delete_expense: {
    description:
      'Offer to delete an expense, given its ref. Nothing is deleted yet: the app shows the user a Delete button to confirm.',
    args: z.object({ ref: z.string().describe('The expense’s ref') }),
  },
}
export type ToolName = keyof typeof tools

export function isToolName(name: string): name is ToolName {
  return Object.hasOwn(tools, name)
}

export const toolDefinitions: Array<ToolDefinition> = Object.entries(tools).map(
  ([name, tool]) => {
    const { $schema: _, ...parameters } = z.toJSONSchema(tool.args)
    return { type: 'function', function: { name, description: tool.description, parameters } }
  },
)

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

function isMe(who: string, context: Context) {
  return ['me', 'i', 'myself', 'you', context.name.toLowerCase()].includes(
    who.trim().toLowerCase(),
  )
}

// Group members by name, where "me" (and the like) is the user's member.
function memberFinder(
  context: Context,
  group: { name: string; meMemberId: string; members: Array<{ id: string; name: string }> },
) {
  return (who: string) =>
    isMe(who, context)
      ? group.members.find((m) => m.id === group.meMemberId)!
      : findByName(group.members, who, `member of ${group.name}`)
}

// Member ids for names, or the first error.
function memberIds(find: ReturnType<typeof memberFinder>, names: Array<string>) {
  const ids: Array<string> = []
  for (const name of names) {
    const member = find(name)
    if (typeof member === 'string') return member
    ids.push(member.id)
  }
  return ids
}

const toCents = (amount: number) => Math.round(amount * 100)

// An expense as the model sees it: amounts formatted, so it never has to do
// the maths.
function forModel(e: ExpenseView) {
  return {
    ref: e.ref,
    kind: e.kind,
    description: e.description,
    amount: formatMoney(e.amountCents, e.currency),
    your_share: e.kind === 'personal' ? undefined : formatMoney(e.myShareCents, e.currency),
    category: e.category,
    date: e.date,
    with: e.with ?? undefined,
    detail: e.detail ?? undefined,
  }
}

type ToolOutcome = { result: Record<string, unknown>; events: Array<ChatEvent> }

const fail = (error: string): ToolOutcome => ({ result: { ok: false, error }, events: [] })

async function viewOf(ctx: ActionCtx, ref: string): Promise<ExpenseView> {
  const expense = await ctx.runQuery(internal.assistant.expense, { ref })
  if (!expense) throw new ConvexError('That expense doesn’t exist.')
  return expense.view
}

async function added(ctx: ActionCtx, ref: string): Promise<ToolOutcome> {
  const expense = await viewOf(ctx, ref)
  return { result: { ok: true, added: forModel(expense) }, events: [{ type: 'added', expense }] }
}

/**
 * Runs one tool call. Returns what to tell the model and what to show in
 * the chat. Throws ConvexError for problems the user can fix.
 */
export async function runTool(
  ctx: ActionCtx,
  context: Context,
  defaults: { today: string; currency: Currency },
  name: ToolName,
  rawArgs: unknown,
): Promise<ToolOutcome> {
  switch (name) {
    case 'add_personal_expense': {
      const parsed = tools[name].args.safeParse(rawArgs)
      if (!parsed.success) return fail(z.prettifyError(parsed.error))
      const a = parsed.data
      const id = await ctx.runMutation(api.personal.add, {
        description: a.description,
        amountCents: toCents(a.amount),
        currency: a.currency ?? defaults.currency,
        category: a.category,
        date: a.date ?? defaults.today,
      })
      return await added(ctx, `personal:${id}`)
    }

    case 'add_friend_expense': {
      const parsed = tools[name].args.safeParse(rawArgs)
      if (!parsed.success) return fail(z.prettifyError(parsed.error))
      const a = parsed.data
      const friend = findByName(context.friends, a.friend, 'friend')
      if (typeof friend === 'string') return fail(friend)
      const id = await ctx.runMutation(api.friends.addExpense, {
        friendId: friend.id,
        description: a.description,
        amountCents: toCents(a.amount),
        currency: a.currency ?? defaults.currency,
        category: a.category,
        date: a.date ?? defaults.today,
        paidBy: a.paid_by ?? 'me',
        split: a.split ?? 'equal',
      })
      return await added(ctx, `friend:${id}`)
    }

    case 'add_group_expense': {
      const parsed = tools[name].args.safeParse(rawArgs)
      if (!parsed.success) return fail(z.prettifyError(parsed.error))
      const a = parsed.data
      const group = findByName(context.groups, a.group, 'group')
      if (typeof group === 'string') return fail(group)
      const find = memberFinder(context, group)
      const payer = find(a.paid_by ?? 'me')
      if (typeof payer === 'string') return fail(payer)
      const splitAmong = a.split_among?.length
        ? memberIds(find, a.split_among)
        : group.members.map((m) => m.id)
      if (typeof splitAmong === 'string') return fail(splitAmong)
      const id = await ctx.runMutation(api.groups.addExpense, {
        groupId: group.id,
        description: a.description,
        amountCents: toCents(a.amount),
        category: a.category,
        date: a.date ?? defaults.today,
        paidBy: payer.id,
        splitAmong,
      })
      return await added(ctx, `group:${id}`)
    }

    case 'search_expenses': {
      const parsed = tools[name].args.safeParse(rawArgs)
      if (!parsed.success) return fail(z.prettifyError(parsed.error))
      const a = parsed.data
      const friend = a.friend ? findByName(context.friends, a.friend, 'friend') : undefined
      if (typeof friend === 'string') return fail(friend)
      const group = a.group ? findByName(context.groups, a.group, 'group') : undefined
      if (typeof group === 'string') return fail(group)
      const found: SearchResult = await ctx.runQuery(internal.assistant.search, {
        kind: a.kind,
        friendId: friend?.id,
        groupId: group?.id,
        text: a.text,
        category: a.category,
        from: a.date_from,
        to: a.date_to,
        minCents: a.min_amount === undefined ? undefined : toCents(a.min_amount),
        maxCents: a.max_amount === undefined ? undefined : toCents(a.max_amount),
        limit: a.limit ?? 20,
      })
      return {
        result: {
          ok: true,
          count: found.count,
          more_not_searched: found.capped || undefined,
          totals: found.totals.map((t) => ({
            currency: t.currency,
            total: formatMoney(t.cents, t.currency),
            your_share: formatMoney(t.myShareCents, t.currency),
          })),
          expenses: found.expenses.map(forModel),
          note:
            found.count > found.expenses.length
              ? `Listing the newest ${found.expenses.length} of ${found.count}.`
              : undefined,
        },
        events: [{ type: 'found', ...found }],
      }
    }

    case 'update_expense': {
      const parsed = tools[name].args.safeParse(rawArgs)
      if (!parsed.success) return fail(z.prettifyError(parsed.error))
      const a = parsed.data
      const current = await ctx.runQuery(internal.assistant.expense, { ref: a.ref })
      if (!current) return fail('There’s no expense with that ref. Search for it first.')
      const before = current.view
      const common = {
        description: a.description ?? before.description,
        amountCents: a.amount === undefined ? before.amountCents : toCents(a.amount),
        category: a.category ?? before.category,
        date: a.date ?? before.date,
      }

      if (current.kind === 'personal') {
        if (a.paid_by || a.split || a.split_among) {
          return fail('A personal expense has no payer or split.')
        }
        await ctx.runMutation(api.personal.update, {
          expenseId: current.id,
          ...common,
          currency: a.currency ?? before.currency,
          receiptId: current.receiptId,
        })
      } else if (current.kind === 'friend') {
        if (a.split_among) return fail('A friend expense is split with one friend, not members.')
        let paidBy = current.paidBy
        if (a.paid_by) {
          const who = a.paid_by.trim().toLowerCase()
          if (isMe(who, context)) paidBy = 'me'
          else if (who === 'friend' || who === before.with?.toLowerCase()) paidBy = 'friend'
          else return fail(`“${a.paid_by}” isn’t you or ${before.with}.`)
        }
        await ctx.runMutation(api.friends.updateExpense, {
          entryId: current.id,
          ...common,
          currency: a.currency ?? before.currency,
          paidBy,
          split: a.split ?? current.split,
          receiptId: current.receiptId,
        })
      } else {
        if (a.split) return fail('Group expenses are split equally between chosen members.')
        if (a.currency && a.currency !== before.currency) {
          return fail(`Expenses in ${before.with} are always in ${before.currency}.`)
        }
        const find = memberFinder(context, {
          name: before.with ?? 'the group',
          meMemberId: current.meMemberId,
          members: current.members,
        })
        const payer = a.paid_by ? find(a.paid_by) : { id: current.paidBy }
        if (typeof payer === 'string') return fail(payer)
        const splitAmong = a.split_among?.length
          ? memberIds(find, a.split_among)
          : current.splitAmong
        if (typeof splitAmong === 'string') return fail(splitAmong)
        await ctx.runMutation(api.groups.updateExpense, {
          expenseId: current.id,
          ...common,
          paidBy: payer.id,
          splitAmong,
          receiptId: current.receiptId,
        })
      }

      const expense = await viewOf(ctx, a.ref)
      return {
        result: { ok: true, before: forModel(before), after: forModel(expense) },
        events: [{ type: 'updated', expense, before }],
      }
    }

    case 'delete_expense': {
      const parsed = tools[name].args.safeParse(rawArgs)
      if (!parsed.success) return fail(z.prettifyError(parsed.error))
      const current = await ctx.runQuery(internal.assistant.expense, { ref: parsed.data.ref })
      if (!current) return fail('There’s no expense with that ref. Search for it first.')
      return {
        result: {
          ok: true,
          awaiting_confirmation: true,
          expense: forModel(current.view),
          note: 'Not deleted yet. The user confirms with the Delete button shown under your reply.',
        },
        events: [{ type: 'delete', expense: current.view }],
      }
    }
  }
}
