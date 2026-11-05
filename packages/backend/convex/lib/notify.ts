import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

type NewNotification = Omit<Doc<'notifications'>, '_id' | '_creationTime' | 'read'>

/** Adds an unread notification for `userId`. Call it in the same mutation. */
export async function notify(ctx: MutationCtx, notification: NewNotification) {
  await ctx.db.insert('notifications', { ...notification, read: false })
}
