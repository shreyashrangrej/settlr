import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

type NewActivity = Omit<Doc<'activity'>, '_id' | '_creationTime'>

/** Adds a line to a group's activity log. Call it in the same mutation. */
export async function logActivity(ctx: MutationCtx, activity: NewActivity) {
  await ctx.db.insert('activity', activity)
}
