import { ConvexError, v } from 'convex/values'
import { z } from 'zod'

import type { Currency } from '../src/lib/schemas'
import { components, internal } from './_generated/api'
import { action, internalQuery, mutation, query, type ActionCtx } from './_generated/server'
import {
  deleteExpense,
  fail,
  isToolName,
  runTool,
  tools,
  type Context,
  type ToolOutcome,
} from './lib/assistantTools'
import { requireUser } from './lib/auth'

// The assistant's tools over MCP (Model Context Protocol), so Claude,
// ChatGPT and other agents can add, find, change and delete the user's
// expenses. The web app's /api/mcp route checks the client's OAuth token
// (see `mcpBridge` in convex/auth.ts), then passes each JSON-RPC request to
// `handle` as the user. The client's own model does the talking, so there's
// no OpenRouter call here; deleting is a real tool, and the client asks the
// user before it runs (it's marked destructive).

const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']
const MAX_CONNECTIONS = 200

const INSTRUCTIONS = `Settlr tracks and splits expenses. These tools act as the signed-in Settlr user.

- Call list_friends_and_groups first: it gives their friends, their groups (with members and currency), their default currency and today's date.
- Kinds of expense: personal (just theirs; use when nobody else is involved), with a friend (one-on-one with someone from the friends list), or in a group (always in the group's currency).
- With a friend, paid_by is "me" when the user paid and "friend" when the friend did; split is "equal" when they share it and "full" when the person who didn't pay owes all of it ("I paid for Sam's lunch" is paid_by "me", split "full").
- Never guess an amount, or who an expense is with: ask. Amounts are in the currency's main unit (12.5 means 12.50).
- Dates are YYYY-MM-DD. Pass the user's local date when you know it; otherwise today in UTC is used.
- In search results, "amount" is the whole expense and "your_share" is what it cost the user; use your_share for "how much did I spend".
- To change or delete an expense, get its ref from search_expenses. If more than one expense fits, ask which one.
- delete_expense can't be undone, so check with the user before calling it.
- Settle-up payments, receipts, moving an expense between personal, a friend and a group, and changing a group expense's currency are done in the Settlr app.`

type Annotations = {
  title: string
  readOnlyHint?: boolean
  destructiveHint?: boolean
  idempotentHint?: boolean
  openWorldHint?: boolean
}

// What MCP clients see. Descriptions and arguments are the chat's (in
// convex/lib/assistantTools.ts) unless replaced here.
const mcpTools: Array<{
  name: string
  description: string
  args: z.ZodObject
  annotations: Annotations
}> = [
  {
    name: 'list_friends_and_groups',
    description:
      'The user’s name, friends, groups (with their members and currency), default currency and today’s date (UTC). Call it before adding expenses with friends or groups.',
    args: z.object({}),
    annotations: { title: 'List friends and groups', readOnlyHint: true },
  },
  {
    name: 'add_personal_expense',
    ...tools.add_personal_expense,
    annotations: { title: 'Add a personal expense', destructiveHint: false },
  },
  {
    name: 'add_friend_expense',
    ...tools.add_friend_expense,
    annotations: { title: 'Add an expense with a friend', destructiveHint: false },
  },
  {
    name: 'add_group_expense',
    ...tools.add_group_expense,
    annotations: { title: 'Add a group expense', destructiveHint: false },
  },
  {
    name: 'search_expenses',
    ...tools.search_expenses,
    annotations: { title: 'Search expenses', readOnlyHint: true },
  },
  {
    name: 'update_expense',
    ...tools.update_expense,
    annotations: { title: 'Change an expense', destructiveHint: true, idempotentHint: true },
  },
  {
    name: 'delete_expense',
    description:
      'Delete an expense, given its ref from search_expenses. It can’t be undone: confirm with the user first.',
    args: tools.delete_expense.args,
    annotations: { title: 'Delete an expense', destructiveHint: true, idempotentHint: true },
  },
]

const toolList = mcpTools.map((tool) => {
  const { $schema: _, ...inputSchema } = z.toJSONSchema(tool.args)
  return {
    name: tool.name,
    title: tool.annotations.title,
    description: tool.description,
    inputSchema,
    annotations: { openWorldHint: false, ...tool.annotations },
  }
})

/** The currency of the user's latest personal expense, else USD. */
export const defaultCurrency = internalQuery({
  args: {},
  handler: async (ctx): Promise<Currency> => {
    const { userId } = await requireUser(ctx)
    const latest = await ctx.db
      .query('personalExpenses')
      .withIndex('by_userId_and_date', (q) => q.eq('userId', userId))
      .order('desc')
      .first()
    return latest?.currency ?? 'USD'
  },
})

class RpcError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message)
  }
}

async function callTool(ctx: ActionCtx, name: string, args: unknown): Promise<ToolOutcome> {
  const context: Context = await ctx.runQuery(internal.assistant.context, {})
  const currency: Currency = await ctx.runQuery(internal.mcp.defaultCurrency, {})
  const today = new Date().toISOString().slice(0, 10)

  if (name === 'list_friends_and_groups') {
    return {
      result: {
        ok: true,
        user: context.name,
        today,
        default_currency: currency,
        friends: context.friends.map((f) => f.name),
        groups: context.groups.map((g) => ({
          name: g.name,
          currency: g.currency,
          members: g.members.map((m) => (m.id === g.meMemberId ? `${m.name} (the user)` : m.name)),
        })),
      },
      events: [],
    }
  }
  if (name === 'delete_expense') return await deleteExpense(ctx, args)
  if (!isToolName(name)) throw new RpcError(-32602, `Unknown tool: ${name}`)
  return await runTool(ctx, context, { today, currency }, name, args)
}

async function dispatch(ctx: ActionCtx, method: string, params: Record<string, unknown>) {
  switch (method) {
    case 'initialize': {
      const asked = params.protocolVersion
      return {
        protocolVersion:
          typeof asked === 'string' && PROTOCOL_VERSIONS.includes(asked)
            ? asked
            : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'settlr', title: 'Settlr', version: '1.0.0' },
        instructions: INSTRUCTIONS,
      }
    }
    case 'ping':
      return {}
    case 'tools/list':
      return { tools: toolList }
    case 'tools/call': {
      const { name, arguments: args } = params
      if (typeof name !== 'string') throw new RpcError(-32602, 'Missing the tool name.')
      let outcome: ToolOutcome
      try {
        outcome = await callTool(ctx, name, args ?? {})
      } catch (err) {
        if (err instanceof RpcError) throw err
        // Mutations throw ConvexError for anything the user can fix.
        if (!(err instanceof ConvexError)) console.error('MCP tool failed', err)
        outcome = fail(
          err instanceof ConvexError && typeof err.data === 'string'
            ? err.data
            : 'That didn’t work.',
        )
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(outcome.result) }],
        isError: outcome.result.ok === false,
      }
    }
    default:
      throw new RpcError(-32601, `Method not found: ${method}`)
  }
}

/**
 * Answers one MCP JSON-RPC request as the caller. `params` and the reply
 * are JSON strings: tool schemas and arguments can have keys Convex values
 * can't (like `$ref`). The reply is `{ result }` or `{ error }`; the route
 * adds `jsonrpc` and `id`.
 */
export const handle = action({
  args: { method: v.string(), params: v.string() },
  handler: async (ctx, args): Promise<string> => {
    await requireSignedIn(ctx)
    let params: unknown
    try {
      params = JSON.parse(args.params)
    } catch {
      return JSON.stringify({ error: { code: -32700, message: 'Parse error' } })
    }
    try {
      const record =
        typeof params === 'object' && params !== null && !Array.isArray(params)
          ? (params as Record<string, unknown>)
          : {}
      return JSON.stringify({ result: await dispatch(ctx, args.method, record) })
    } catch (err) {
      if (err instanceof RpcError) {
        return JSON.stringify({ error: { code: err.code, message: err.message } })
      }
      throw err
    }
  },
})

async function requireSignedIn(ctx: ActionCtx) {
  if (!(await ctx.auth.getUserIdentity())) throw new ConvexError('Sign in to continue.')
}

// The signed-in user's Better Auth id, which OAuth grants are stored under.
async function authUserId(ctx: { auth: ActionCtx['auth'] }) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new ConvexError('Sign in to continue.')
  return identity.subject
}

/** An OAuth client, for the consent page, or null if there's none. */
export const client = query({
  args: { clientId: v.string() },
  handler: async (ctx, args) => {
    await authUserId(ctx)
    const app = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: 'oauthApplication',
      where: [{ field: 'clientId', value: args.clientId }],
    })
    if (!app || app.disabled) return null
    const redirectHosts = [
      ...new Set(
        String(app.redirectUrls ?? '')
          .split(',')
          .flatMap((url) => {
            try {
              return [new URL(url).host]
            } catch {
              return []
            }
          }),
      ),
    ]
    return { name: typeof app.name === 'string' && app.name ? app.name : null, redirectHosts }
  },
})

/** The apps the user has connected over MCP, most recently approved first. */
export const connections = query({
  args: {},
  handler: async (ctx) => {
    const userId = await authUserId(ctx)
    // One consent per approval.
    const { page } = await ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: 'oauthConsent',
      where: [{ field: 'userId', value: userId }],
      paginationOpts: { cursor: null, numItems: MAX_CONNECTIONS },
    })
    const approvedAt = new Map<string, number>()
    for (const consent of page as Array<{ clientId?: string | null; createdAt?: number | null }>) {
      if (!consent.clientId) continue
      const at = consent.createdAt ?? 0
      approvedAt.set(consent.clientId, Math.max(approvedAt.get(consent.clientId) ?? 0, at))
    }
    const apps = await Promise.all(
      [...approvedAt].map(async ([clientId, connectedAt]) => {
        const app = await ctx.runQuery(components.betterAuth.adapter.findOne, {
          model: 'oauthApplication',
          where: [{ field: 'clientId', value: clientId }],
        })
        const name = typeof app?.name === 'string' && app.name ? app.name : 'Unnamed app'
        return { clientId, name, connectedAt }
      }),
    )
    return apps.sort((a, b) => b.connectedAt - a.connectedAt)
  },
})

/** Disconnects an app: deletes its tokens and the user's consent. */
export const disconnect = mutation({
  args: { clientId: v.string() },
  handler: async (ctx, args) => {
    const userId = await authUserId(ctx)
    // Read by the indexed userId (a user has few grants: refreshing retires
    // the old one) and delete this app's rows one by one.
    for (const model of ['oauthAccessToken', 'oauthConsent'] as const) {
      let cursor: string | null = null
      for (;;) {
        const found: {
          page: Array<{ _id: string; clientId?: string | null }>
          isDone: boolean
          continueCursor: string
        } = await ctx.runQuery(components.betterAuth.adapter.findMany, {
          model,
          where: [{ field: 'userId', value: userId }],
          paginationOpts: { cursor, numItems: MAX_CONNECTIONS },
        })
        for (const row of found.page) {
          if (row.clientId !== args.clientId) continue
          await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
            input: { model, where: [{ field: '_id', value: row._id }] },
          })
        }
        if (found.isDone) break
        cursor = found.continueCursor
      }
    }
    return null
  },
})
