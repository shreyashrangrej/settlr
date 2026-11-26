import { v } from 'convex/values'

import { formatMoney } from '@settlr/shared/format'
import { internalAction } from './_generated/server'
import { sendEmail } from './email'
import { currency } from './lib/validators'

// Emails other than sign-in codes: reminders to friends who aren't on
// Settlr, and the weekly digest. Without RESEND_API_KEY they're logged.

function escape(text: string) {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

export const reminder = internalAction({
  args: {
    to: v.string(),
    fromName: v.string(),
    friendName: v.string(),
    amounts: v.array(v.object({ currency, cents: v.number() })),
  },
  handler: async (_ctx, args) => {
    const owed = args.amounts.map((a) => formatMoney(a.cents, a.currency)).join(' + ')
    await sendEmail({
      to: args.to,
      subject: `${args.fromName} sent you a reminder`,
      text: `Hi ${args.friendName},\n\nJust a friendly reminder from ${args.fromName}: you owe them ${owed} on Settlr.\n\nIf you've already paid, let them know so they can record it.`,
      html: `<p>Hi ${escape(args.friendName)},</p><p>Just a friendly reminder from <strong>${escape(args.fromName)}</strong>: you owe them <strong>${escape(owed)}</strong> on Settlr.</p><p>If you've already paid, let them know so they can record it.</p>`,
    })
    return null
  },
})
