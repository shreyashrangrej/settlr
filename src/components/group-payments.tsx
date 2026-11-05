'use client'

import { useState } from 'react'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { ArrowRight, Trash2 } from 'lucide-react'

import { ConfirmAction } from '#/components/confirm-action'
import { AmountInput, DatePicker, SelectField } from '#/components/form-fields'
import { useAction } from '#/components/ledger'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog'
import { Spinner } from '#/components/ui/spinner'
import { formatDate, formatMoney, memberName, parseAmountToCents, todayIsoDate } from '#/lib/format'
import type { Group } from '#/lib/types'
import { api } from '#convex/_generated/api'

const label = 'text-[0.8125rem] font-medium text-muted-foreground'

/**
 * A button that opens a form for recording a settle-up payment between two
 * members. `from`, `to` and `amountCents` prefill it (e.g. from the
 * settle-up plan); everything can still be changed.
 */
export function RecordPaymentDialog({
  group,
  from,
  to,
  amountCents,
  trigger,
}: {
  group: Group
  from?: string
  to?: string
  amountCents?: number
  /** The element that opens it (a Base UI `render` element, e.g. a Button). */
  trigger: React.ReactElement
}) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a payment</DialogTitle>
          <DialogDescription>
            Once someone has paid, record it here and everyone’s balance updates.
          </DialogDescription>
        </DialogHeader>
        {/* Mounts on open, so it starts from the suggested values each time. */}
        <PaymentForm
          group={group}
          from={from}
          to={to}
          amountCents={amountCents}
          onSaved={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function PaymentForm({
  group,
  from: initialFrom,
  to: initialTo,
  amountCents,
  onSaved,
}: {
  group: Group
  from?: string
  to?: string
  amountCents?: number
  onSaved: () => void
}) {
  const me = group.meMemberId
  const other = group.members.find((m) => m.id !== me)?.id ?? ''
  const [from, setFrom] = useState(initialFrom ?? other)
  const [to, setTo] = useState(initialTo ?? me)
  const [amount, setAmount] = useState(
    amountCents ? (amountCents / 100).toFixed(2) : '',
  )
  // The dialog only renders in the browser, so the viewer's clock is fine.
  const [date, setDate] = useState(todayIsoDate)
  const addPayment = useConvexMutation(api.groups.addPayment)
  const { run, pending, error, setError } = useAction(addPayment, {
    success: 'Payment recorded',
  })
  const options = group.members.map((m) => ({
    value: m.id,
    label: m.id === me ? 'You' : m.name,
  }))

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const cents = parseAmountToCents(amount)
    if (!cents) {
      setError('Enter an amount like 12.50')
      return
    }
    if (from === to) {
      setError('Pick two different people.')
      return
    }
    if (await run({ groupId: group.id, from, to, amountCents: cents, date })) onSaved()
  }

  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
        <div className="grid gap-2">
          <label htmlFor="pay-from" className={label}>
            Paid by
          </label>
          <SelectField id="pay-from" value={from} onChange={setFrom} options={options} />
        </div>
        <ArrowRight className="mb-3.5 size-4 text-muted-foreground" aria-hidden="true" />
        <div className="grid gap-2">
          <label htmlFor="pay-to" className={label}>
            Paid to
          </label>
          <SelectField id="pay-to" value={to} onChange={setTo} options={options} />
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(11rem,100%),1fr))] gap-3">
        <div className="grid gap-2">
          <label htmlFor="pay-amount" className={label}>
            Amount
          </label>
          <AmountInput
            id="pay-amount"
            value={amount}
            onChange={setAmount}
            currency={group.currency}
            invalid={Boolean(error)}
          />
        </div>
        <div className="grid gap-2">
          <label htmlFor="pay-date" className={label}>
            Date
          </label>
          <DatePicker id="pay-date" value={date} onChange={setDate} />
        </div>
      </div>
      {error && <p className="text-[0.8125rem] text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="submit" size="lg" disabled={pending}>
          {pending && <Spinner />}
          Record payment
        </Button>
      </DialogFooter>
    </form>
  )
}

/** The group's latest settle-up payments, each with a delete button. */
export function RecentPayments({ group }: { group: Group }) {
  const { data: payments } = useSuspenseQuery(
    convexQuery(api.groups.payments, { groupId: group.id }),
  )
  const removePayment = useConvexMutation(api.groups.removePayment)
  const { run } = useAction(removePayment, { success: 'Payment deleted', toastErrors: true })
  if (payments.length === 0) return null
  const name = (id: string) => (id === group.meMemberId ? 'You' : memberName(group.members, id))

  return (
    <div className="grid gap-2">
      <h3 className="m-0 text-sm font-semibold">Recent payments</h3>
      <ul className="grid">
        {payments.map((p) => {
          const summary = `${name(p.from)} paid ${p.to === group.meMemberId ? 'you' : name(p.to)}`
          return (
            <li
              key={p.id}
              className="flex items-center gap-2 border-t border-divider py-2 text-sm first:border-t-0"
            >
              <span className="grid min-w-0 flex-1">
                <span className="truncate">{summary}</span>
                <span className="text-xs text-muted-foreground">{formatDate(p.date)}</span>
              </span>
              <span className="font-mono font-medium tabular-nums">
                {formatMoney(p.amountCents, group.currency)}
              </span>
              <ConfirmAction
                title="Delete this payment?"
                description={`${summary} ${formatMoney(p.amountCents, group.currency)}. Balances go back to how they were before it.`}
                onConfirm={async () => Boolean(await run({ paymentId: p.id }))}
                trigger={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete payment: ${summary}`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 />
                  </Button>
                }
              />
            </li>
          )
        })}
      </ul>
    </div>
  )
}
