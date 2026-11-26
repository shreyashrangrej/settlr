import { ConvexError, v } from 'convex/values'

import type { Id } from './_generated/dataModel'
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'
import { requireUser } from './lib/auth'

// Saved assistant conversations: each finished turn (your message and the
// reply) is appended, so a chat can be reopened later.

const MAX_CHATS = 50
const MAX_MESSAGES = 200

async function ownChat(ctx: QueryCtx, userId: string, chatId: string) {
  const id = ctx.db.normalizeId('assistantChats', chatId)
  const chat = id ? await ctx.db.get('assistantChats', id) : null
  return chat && chat.userId === userId ? chat : null
}

/** Your saved chats, most recent first. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireUser(ctx)
    const chats = await ctx.db
      .query('assistantChats')
      .withIndex('by_userId_and_updatedAt', (q) => q.eq('userId', userId))
      .order('desc')
      .take(MAX_CHATS)
    return chats.map((c) => ({ id: c._id, title: c.title, updatedAt: c.updatedAt }))
  },
})

/** One chat's messages, oldest first. */
export const get = query({
  args: { chatId: v.string() },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const chat = await ownChat(ctx, userId, args.chatId)
    if (!chat) return null
    const messages = await ctx.db
      .query('assistantMessages')
      .withIndex('by_chatId', (q) => q.eq('chatId', chat._id))
      .take(MAX_MESSAGES)
    return {
      id: chat._id,
      title: chat.title,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        memo: m.memo ?? '',
        events: m.events ?? '[]',
      })),
    }
  },
})

/** Saves a finished turn, starting a chat when `chatId` is null. */
export const append = mutation({
  args: {
    chatId: v.union(v.id('assistantChats'), v.null()),
    user: v.string(),
    reply: v.string(),
    memo: v.string(),
    events: v.string(),
  },
  handler: async (ctx, args): Promise<Id<'assistantChats'>> => {
    const { userId } = await requireUser(ctx)
    const now = Date.now()
    let chatId = args.chatId
    if (chatId) {
      const chat = await ownChat(ctx, userId, chatId)
      if (!chat) throw new ConvexError('That chat was deleted.')
      await ctx.db.patch('assistantChats', chat._id, { updatedAt: now })
    } else {
      const title = args.user.trim().replace(/\s+/g, ' ').slice(0, 60) || 'Chat'
      chatId = await ctx.db.insert('assistantChats', { userId, title, updatedAt: now })
      // Keep only the newest chats.
      const old = await ctx.db
        .query('assistantChats')
        .withIndex('by_userId_and_updatedAt', (q) => q.eq('userId', userId))
        .order('desc')
        .take(MAX_CHATS + 5)
      for (const chat of old.slice(MAX_CHATS)) await removeChat(ctx, chat._id)
    }
    const count = await ctx.db
      .query('assistantMessages')
      .withIndex('by_chatId', (q) => q.eq('chatId', chatId))
      .take(MAX_MESSAGES)
    if (count.length + 2 > MAX_MESSAGES) {
      throw new ConvexError('This chat is full. Start a new one.')
    }
    await ctx.db.insert('assistantMessages', {
      chatId,
      role: 'user',
      content: args.user.slice(0, 500),
    })
    await ctx.db.insert('assistantMessages', {
      chatId,
      role: 'assistant',
      content: args.reply.slice(0, 4000),
      memo: args.memo.slice(0, 4000) || undefined,
      // Cards can be large; keep them under Convex's value limit.
      events: args.events.length < 200_000 ? args.events : '[]',
    })
    return chatId
  },
})

async function removeChat(
  ctx: MutationCtx,
  chatId: Id<'assistantChats'>,
) {
  const messages = await ctx.db
    .query('assistantMessages')
    .withIndex('by_chatId', (q) => q.eq('chatId', chatId))
    .take(MAX_MESSAGES + 10)
  for (const m of messages) await ctx.db.delete('assistantMessages', m._id)
  await ctx.db.delete('assistantChats', chatId)
}

export const remove = mutation({
  args: { chatId: v.id('assistantChats') },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const chat = await ownChat(ctx, userId, args.chatId)
    if (chat) await removeChat(ctx, chat._id)
    return null
  },
})
