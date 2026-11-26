import { cronJobs } from 'convex/server'

import { internal } from './_generated/api'

const crons = cronJobs()

// Recurring expenses due today (UTC), shortly after midnight.
crons.cron('add recurring expenses', '10 0 * * *', internal.recurring.processDue, {})

// Deleted expenses are kept for 30 days.
crons.cron('empty old trash', '30 1 * * *', internal.trash.purgeExpired, {})

// The weekly digest email, Monday mornings (UTC).
crons.cron('weekly digest', '0 7 * * 1', internal.digest.sendAll, {})

export default crons
