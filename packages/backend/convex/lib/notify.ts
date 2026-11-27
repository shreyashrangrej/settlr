import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

// One reminder a day per friend, and per member of a group.
export const REMIND_EVERY_MS = 20 * 60 * 60 * 1000

type NewNotification = Omit<Doc<'notifications'>, '_id' | '_creationTime' | 'read'>

/** Adds an unread notification for `userId`. Call it in the same mutation. */
export async function notify(ctx: MutationCtx, notification: NewNotification) {
  await ctx.db.insert('notifications', { ...notification, read: false })
}
