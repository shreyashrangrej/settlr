'use client'

import { useState } from 'react'
import { useConvexMutation } from '@convex-dev/react-query'
import Link from 'next/link'

import { AmountInput, CategorySelect, DatePicker, SelectField } from '#/components/form-fields'
import { useAction } from '#/components/ledger'
import { useAppRouter } from '#/components/navigation-progress'
import { ReceiptField, existingReceipt, type ReceiptValue } from '#/components/receipts'
import { Section } from '#/components/section'
import { Button, buttonVariants } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Spinner } from '#/components/ui/spinner'
import { formatMoney, parseAmountToCents, todayIsoDate } from '#/lib/format'
import { addExpenseInput, type AddExpenseInput, type Category } from '#/lib/schemas'
import type { Group, GroupExpenseDetail } from '#/lib/types'
import { api } from '#convex/_generated/api'

/**
 * Adds an expense to a group, or with `expense`, edits it. Either way it
 * goes back to the group's expenses once saved.
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

  // Live preview of each person's share (the server does the exact split).
  const cents = parseAmountToCents(amount)
  const share = cents && splitAmong.length ? Math.floor(cents / splitAmong.length) : null

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
    <Section
      className="max-w-3xl"
      title={expense ? 'Edit expense' : 'Add an expense'}
      description={
        expense
          ? 'Balances update for everyone in the group.'
          : 'Split equally between the people who shared it.'
      }
    >
      <form noValidate onSubmit={onSubmit} className="mt-2 grid gap-8">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="ge-description">Description</FieldLabel>
            <Input
              id="ge-description"
              value={description}
              maxLength={80}
              placeholder="Dinner"
              autoFocus={!expense}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="ge-amount">Amount</FieldLabel>
              <AmountInput
                id="ge-amount"
                value={amount}
                onChange={setAmount}
                currency={group.currency}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="ge-date">Date</FieldLabel>
              <DatePicker id="ge-date" value={date} onChange={setDate} />
            </Field>
            <Field>
              <FieldLabel htmlFor="ge-paid-by">Paid by</FieldLabel>
              <SelectField
                id="ge-paid-by"
                value={paidBy}
                onChange={setPaidBy}
                options={group.members.map((m) => ({
                  value: m.id,
                  label: m.id === group.meMemberId ? `${m.name} (you)` : m.name,
                }))}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="ge-category">Category</FieldLabel>
              <CategorySelect id="ge-category" value={category} onChange={setCategory} />
            </Field>
          </div>

          <FieldSet>
            <FieldLegend variant="label">Split equally between</FieldLegend>
            <FieldDescription>
              {share !== null
                ? `${formatMoney(share, group.currency)} each`
                : 'Everyone is included by default.'}
            </FieldDescription>
            <div className="grid gap-3 sm:grid-cols-2">
              {group.members.map((m) => (
                <Field key={m.id} orientation="horizontal">
                  <Checkbox
                    id={`split-${m.id}`}
                    checked={splitAmong.includes(m.id)}
                    onCheckedChange={(checked) =>
                      setSplitAmong((current) =>
                        checked
                          ? group.members.map((x) => x.id).filter((id) => id === m.id || current.includes(id))
                          : current.filter((id) => id !== m.id),
                      )
                    }
                  />
                  <FieldLabel htmlFor={`split-${m.id}`} className="font-normal">
                    {m.name}
                    {m.id === group.meMemberId && (
                      <span className="text-muted-foreground">(you)</span>
                    )}
                  </FieldLabel>
                </Field>
              ))}
            </div>
          </FieldSet>

          <Field>
            <FieldLabel htmlFor="ge-receipt">Receipt</FieldLabel>
            <ReceiptField id="ge-receipt" value={receipt} onChange={setReceipt} />
            <FieldDescription>Everyone in the group can see it.</FieldDescription>
          </Field>
          {error && <FieldError>{error}</FieldError>}
        </FieldGroup>
        <div className="flex justify-end gap-2 border-t pt-6">
          <Link
            href={`/groups/${group.id}`}
            className={buttonVariants({ variant: 'ghost', size: 'lg' })}
          >
            Cancel
          </Link>
          <Button type="submit" size="lg" disabled={pending}>
            {pending && <Spinner />}
            {expense ? 'Save changes' : 'Add expense'}
          </Button>
        </div>
      </form>
    </Section>
  )
}
