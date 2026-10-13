'use client'

import { useState } from 'react'
import { useConvexMutation } from '@convex-dev/react-query'
import Link from 'next/link'
import { ArrowRight, Pencil, Plus } from 'lucide-react'

import { CategoryChips, DatePicker, SelectField } from '#/components/form-fields'
import { PersonAvatar, SignedAmount, useAction } from '#/components/ledger'
import { useAppRouter } from '#/components/navigation-progress'
import { ReceiptField, existingReceipt, type ReceiptValue } from '#/components/receipts'
import { Button, buttonVariants } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
import { FieldError } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Spinner } from '#/components/ui/spinner'
import { formatMoney, memberName, parseAmountToCents, plural, todayIsoDate } from '#/lib/format'
import { addExpenseInput, type AddExpenseInput, type Category } from '#/lib/schemas'
import type { Group, GroupExpenseDetail } from '#/lib/types'
import { cn } from '#/lib/utils'
import { api } from '#convex/_generated/api'

const label = 'text-[0.8125rem] font-medium text-soft'

// Each participant's share, split the way the server does it
// (convex/lib/ledger.ts): leftover cents go to the first ones in member order.
function previewShares(amountCents: number, splitAmong: Array<string>, order: Array<string>) {
  const participants = order.filter((id) => splitAmong.includes(id))
  const result = new Map<string, number>()
  if (participants.length === 0) return result
  const base = Math.floor(amountCents / participants.length)
  const remainder = amountCents - base * participants.length
  participants.forEach((id, i) => result.set(id, base + (i < remainder ? 1 : 0)))
  return result
}

// How an expense moves one member's balance: what they paid minus their share.
function effectOn(
  memberId: string,
  expense: { amountCents: number; paidBy: string; splitAmong: Array<string> },
  order: Array<string>,
) {
  const share = previewShares(expense.amountCents, expense.splitAmong, order).get(memberId) ?? 0
  return (expense.paidBy === memberId ? expense.amountCents : 0) - share
}

/**
 * Adds an expense to a group, or with `expense`, edits it: the details on
 * the left, who shares it and what that does to your balance on the right.
 * Either way it goes back to the group's expenses once saved.
 */
export function GroupExpenseForm({
  group,
  expense,
}: {
  group: Group
  expense?: GroupExpenseDetail
}) {
  const router = useAppRouter()
  const addExpense = useConvexMutation(api.groups.addExpense)
  const updateExpense = useConvexMutation(api.groups.updateExpense)
  const { run, pending, error, setError } = useAction(
    async (input: AddExpenseInput, receipt: ReceiptValue) =>
      expense
        ? updateExpense({ expenseId: expense.id, ...input, receiptId: receipt?.id ?? null })
        : addExpense({ groupId: group.id, ...input, receiptId: receipt?.id }),
    { success: expense ? 'Expense updated' : 'Expense added' },
  )
  const [description, setDescription] = useState(expense?.description ?? '')
  const [amount, setAmount] = useState(
    expense ? (expense.amountCents / 100).toFixed(2) : '',
  )
  const [date, setDate] = useState(expense?.date ?? todayIsoDate)
  const [paidBy, setPaidBy] = useState(expense?.paidBy ?? group.meMemberId)
  const [category, setCategory] = useState<Category>(expense?.category ?? 'food')
  const [splitAmong, setSplitAmong] = useState(
    () => expense?.splitAmong ?? group.members.map((m) => m.id),
  )
  const [receipt, setReceipt] = useState<ReceiptValue>(() => existingReceipt(expense?.receiptId))

  // Live preview of the split and of your balance afterwards (the server
  // does the same math when it saves).
  const me = group.meMemberId
  const order = group.members.map((m) => m.id)
  const cents = parseAmountToCents(amount) ?? 0
  const shares = previewShares(cents, splitAmong, order)
  const myShare = shares.get(me) ?? 0
  const payer = paidBy === me ? 'you' : memberName(group.members, paidBy)
  const balanceBefore = group.members.find((m) => m.id === me)?.netCents ?? 0
  const balanceAfter =
    balanceBefore -
    (expense ? effectOn(me, expense, order) : 0) +
    effectOn(me, { amountCents: cents, paidBy, splitAmong }, order)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const amountCents = parseAmountToCents(amount)
    if (amountCents === null) {
      setError('Enter an amount like 12.50')
      return
    }
    // Same limits the Convex mutation checks.
    const parsed = addExpenseInput.safeParse({
      description,
      amountCents,
      paidBy,
      splitAmong,
      category,
      date,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form')
      return
    }
    if (await run(parsed.data, receipt)) {
      router.push(`/groups/${group.id}`)
    }
  }

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className="overflow-hidden rounded-[28px] border bg-card"
    >
      <header className="flex items-center gap-3.5 border-b border-divider px-6 py-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground [&_svg]:size-5">
          {expense ? <Pencil /> : <Plus strokeWidth={2.4} />}
        </span>
        <div className="grid min-w-0 gap-0.5">
          <h2 className="m-0 text-xl font-semibold tracking-[-0.03em]">
            {expense ? 'Edit expense' : 'Add an expense'}
          </h2>
          <p className="truncate text-[0.8125rem] text-muted-foreground">
            {expense ? 'In' : 'Goes into'} {group.name} · {plural(group.members.length, 'member')}
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-stretch">
        <div className="flex min-w-0 flex-[3_1_26rem] flex-col gap-5 p-6">
          <label
            htmlFor="ge-amount"
            className="flex flex-col gap-2 rounded-[20px] border border-primary bg-background px-5 py-4.5"
          >
            <span className="text-xs text-muted-foreground">Amount</span>
            <span className="flex items-center gap-3">
              <span className="rounded-[10px] bg-tile px-2.5 py-1.5 text-[0.8125rem] font-semibold text-soft">
                {group.currency}
              </span>
              <input
                id="ge-amount"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                value={amount}
                autoFocus={!expense}
                onChange={(e) => setAmount(e.target.value)}
                className="min-w-0 flex-1 border-0 bg-transparent font-mono text-[2.75rem] leading-none font-medium tracking-[-0.04em] tabular-nums outline-none placeholder:text-dim"
              />
            </span>
          </label>

          <div className="grid gap-2">
            <label htmlFor="ge-description" className={label}>
              Description
            </label>
            <Input
              id="ge-description"
              value={description}
              maxLength={80}
              placeholder="Dinner"
              className="h-12 md:text-[0.9375rem]"
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <fieldset className="m-0 grid gap-2 border-0 p-0">
            <legend className={cn(label, 'mb-2 p-0')}>Category</legend>
            <CategoryChips value={category} onChange={setCategory} />
          </fieldset>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(11rem,100%),1fr))] gap-3">
            <div className="grid gap-2">
              <label htmlFor="ge-date" className={label}>
                Date
              </label>
              <DatePicker id="ge-date" value={date} onChange={setDate} className="h-12" />
            </div>
            <div className="grid gap-2">
              <label htmlFor="ge-paid-by" className={label}>
                Paid by
              </label>
              <SelectField
                id="ge-paid-by"
                value={paidBy}
                onChange={setPaidBy}
                className="data-[size=default]:h-12"
                options={group.members.map((m) => ({
                  value: m.id,
                  label: m.id === me ? 'You' : m.name,
                }))}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <label htmlFor="ge-receipt" className={label}>
              Receipt <span className="font-normal text-faint">(optional)</span>
            </label>
            <ReceiptField id="ge-receipt" value={receipt} onChange={setReceipt} />
            <p className="text-xs text-muted-foreground">Everyone in the group can see it.</p>
          </div>
        </div>

        <aside
          aria-labelledby="ge-split"
          className="flex min-w-0 flex-[2_1_20rem] flex-col gap-4.5 border-t border-divider bg-field p-6 lg:border-t-0 lg:border-l"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 id="ge-split" className="m-0 text-base font-semibold tracking-[-0.02em]">
              Split
            </h3>
            <span className="text-[0.8125rem] text-muted-foreground">Equally</span>
          </div>

          <div className="grid gap-2">
            {group.members.map((m) => {
              const included = splitAmong.includes(m.id)
              return (
                <label
                  key={m.id}
                  htmlFor={`split-${m.id}`}
                  className={cn(
                    'flex min-h-14 cursor-pointer items-center gap-3 rounded-[14px] border bg-card px-3',
                    !included && 'opacity-60',
                  )}
                >
                  <Checkbox
                    id={`split-${m.id}`}
                    checked={included}
                    onCheckedChange={(checked) =>
                      setSplitAmong((current) =>
                        checked
                          ? order.filter((id) => id === m.id || current.includes(id))
                          : current.filter((id) => id !== m.id),
                      )
                    }
                  />
                  <PersonAvatar name={m.name} me={m.id === me} />
                  <span className="grid min-w-0 flex-1">
                    <span className="truncate font-semibold">{m.id === me ? 'You' : m.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {m.id === paidBy
                        ? cents
                          ? `paid ${formatMoney(cents, group.currency)}`
                          : 'paying'
                        : included
                          ? m.id === me
                            ? `you’ll owe ${payer}`
                            : `will owe ${payer}`
                          : 'not included'}
                    </span>
                  </span>
                  <span className="font-mono font-medium tabular-nums">
                    {included ? formatMoney(shares.get(m.id) ?? 0, group.currency) : '—'}
                  </span>
                </label>
              )
            })}
          </div>

          <div className="grid gap-3 rounded-2xl border bg-card p-4">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Total</span>
              <span className="font-mono font-medium tabular-nums">
                {formatMoney(cents, group.currency)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Split</span>
              <span>
                {splitAmong.length === 0
                  ? 'Nobody yet'
                  : `${splitAmong.length} ${splitAmong.length === 1 ? 'way' : 'ways'}, equally`}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">
                {paidBy === me ? 'You’ll get back' : `You’ll owe ${payer}`}
              </span>
              <span
                className={cn(
                  'font-mono font-medium tabular-nums',
                  paidBy === me ? 'text-positive' : myShare > 0 && 'text-destructive',
                )}
              >
                {formatMoney(paidBy === me ? cents - myShare : myShare, group.currency)}
              </span>
            </div>
            <div className="h-px bg-border" />
            <div className="grid gap-2">
              <span className="text-xs text-muted-foreground">Your {group.name} balance</span>
              <div className="flex flex-wrap items-center gap-2.5 text-lg">
                <SignedAmount cents={balanceBefore} currency={group.currency} />
                <ArrowRight className="size-4.5 text-muted-foreground" role="img" aria-label="becomes" />
                <SignedAmount cents={balanceAfter} currency={group.currency} />
              </div>
            </div>
          </div>

          {error && <FieldError>{error}</FieldError>}

          <div className="mt-auto flex gap-2.5">
            <Link
              href={`/groups/${group.id}`}
              className={cn(
                buttonVariants({ variant: 'outline' }),
                'h-12.5 flex-1 rounded-[14px] text-sm no-underline',
              )}
            >
              Cancel
            </Link>
            <Button type="submit" className="h-12.5 flex-[2] rounded-[14px] text-sm" disabled={pending}>
              {pending && <Spinner />}
              {expense ? 'Save changes' : 'Save expense'}
            </Button>
          </div>
        </aside>
      </div>
    </form>
  )
}
