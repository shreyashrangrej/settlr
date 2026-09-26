'use client'

import { useEffect, useId, useState } from 'react'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { HandCoins, Plus, Receipt, Trash2, UserPlus } from 'lucide-react'

import { ConfirmAction } from '#/components/confirm-action'
import { EditDialog, FormDialog } from '#/components/edit-dialog'
import {
  AmountInput,
  CategorySelect,
  CurrencySelect,
  DatePicker,
  SelectField,
} from '#/components/form-fields'
import {
  BalanceText,
  FriendStatusBadge,
  PersonAvatar,
  useAction,
} from '#/components/ledger'
import { useAppRouter } from '#/components/navigation-progress'
import { PageHeader } from '#/components/page-header'
import {
  ReceiptField,
  ReceiptLink,
  existingReceipt,
  type ReceiptValue,
} from '#/components/receipts'
import { Panel, Section } from '#/components/section'
import { Badge } from '#/components/ui/badge'
import { Button, buttonVariants } from '#/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '#/components/ui/empty'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { Spinner } from '#/components/ui/spinner'
import {
  categoryLabel,
  formatDate,
  formatMoney,
  parseAmountToCents,
  todayIsoDate,
} from '#/lib/format'
import { readPreferences } from '#/lib/preferences'
import { searchHref } from '#/lib/search'
import {
  LIST_STEP,
  friendExpenseInput,
  friendPaymentInput,
  listSearchDefaults,
  type Category,
  type Currency,
  type FriendExpenseInput,
  type FriendPaymentInput,
} from '#/lib/schemas'
import type { Friend, FriendEntry } from '#/lib/types'
import { cn } from '#/lib/utils'
import { api } from '#convex/_generated/api'

/** A friend and your one-on-one ledger. `limit` is the "show more" size. */
export function FriendView({ friendId, limit }: { friendId: string; limit: number }) {
  const { data: friend } = useSuspenseQuery(
    convexQuery(api.friends.get, { friendId }),
  )
  const { data: ledger } = useSuspenseQuery(
    convexQuery(api.friends.entries, { friendId, limit }),
  )

  // Deleted while open (here or in another tab).
  if (!friend) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>This friend was removed</EmptyTitle>
          <EmptyDescription>
            <Link href="/friends">Back to friends</Link>
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <>
      <PageHeader
        back={{ fallback: '/friends', label: 'Back to friends' }}
        media={<PersonAvatar name={friend.name} size="lg" />}
        title={friend.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {friend.email}
            <FriendStatusBadge status={friend.status} />
            {friend.status === 'linked' && (
              <span>· {friend.name} sees these entries too</span>
            )}
          </span>
        }
        actions={
          <>
            <BalanceText
              balances={friend.balances}
              them={friend.name}
              className="mr-2 text-right text-lg"
            />
            {friend.email && (friend.status === null || friend.status === 'declined') && (
              <SendRequest friendId={friend.id} email={friend.email} />
            )}
            <FormDialog
              title="Settle up"
              description={`Record money that changed hands between you and ${friend.name}.`}
              trigger={
                <Button variant="outline" size="lg">
                  <HandCoins />
                  Settle up
                </Button>
              }
            >
              {(close) => <PaymentForm friend={friend} onSaved={close} />}
            </FormDialog>
            <FormDialog
              title="Add an expense"
              description={`Something you and ${friend.name} shared.`}
              trigger={
                <Button size="lg">
                  <Plus />
                  Add expense
                </Button>
              }
            >
              {(close) => <ExpenseForm friend={friend} onSaved={close} />}
            </FormDialog>
            <RemoveFriend friend={friend} />
          </>
        }
      />

      <Section title="Activity" description="Expenses and payments between you, newest first">
        <Panel>
          {ledger.items.length === 0 ? (
            <Empty className="py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Receipt />
                </EmptyMedia>
                <EmptyTitle>Nothing yet</EmptyTitle>
                <EmptyDescription>
                  Add an expense you shared with {friend.name}.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            // Fixed layout: the data columns share the width equally.
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead className="hidden lg:table-cell">Details</TableHead>
                  <TableHead className="text-right">Effect</TableHead>
                  <TableHead className="w-20">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.items.map((entry) => (
                  <EntryRow key={entry.id} entry={entry} friend={friend} />
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>
        {ledger.hasMore && (
          <Link
            href={searchHref(`/friends/${friendId}`, { limit: limit + LIST_STEP }, listSearchDefaults)}
            scroll={false}
            className={cn(buttonVariants({ variant: 'outline' }), 'justify-self-center no-underline')}
          >
            Show more
          </Link>
        )}
      </Section>
    </>
  )
}

function EntryRow({ entry, friend }: { entry: FriendEntry; friend: Friend }) {
  const friendName = friend.name
  const removeEntry = useConvexMutation(api.friends.removeEntry)
  const { run } = useAction(removeEntry, {
    success: 'Deleted',
    toastErrors: true,
  })
  const title =
    entry.kind === 'expense'
      ? entry.description
      : entry.paidBy === 'me'
        ? `You paid ${friendName}`
        : `${friendName} paid you`
  const detail =
    entry.kind === 'expense'
      ? `${entry.paidBy === 'me' ? 'You' : friendName} paid ${formatMoney(entry.amountCents, entry.currency)} · ${
          entry.split === 'equal' ? 'split equally' : 'owed in full'
        }`
      : (entry.note ?? 'Settle-up payment')

  return (
    <TableRow>
      <TableCell>
        <span className="flex items-center gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted [&_svg]:size-4">
            {entry.kind === 'payment' ? (
              <HandCoins className="text-primary" />
            ) : (
              <Receipt className="text-muted-foreground" />
            )}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1">
              <span className="truncate font-medium" title={title}>
                {title}
              </span>
              {entry.kind === 'expense' && entry.receiptId && (
                <ReceiptLink source="friend" expenseId={entry.id} />
              )}
            </span>
            <span className="block truncate text-xs text-muted-foreground lg:hidden">
              <span className="md:hidden">{formatDate(entry.date)} · </span>
              {detail}
            </span>
          </span>
        </span>
      </TableCell>
      <TableCell className="hidden text-muted-foreground md:table-cell">
        {formatDate(entry.date)}
      </TableCell>
      <TableCell className="hidden text-muted-foreground lg:table-cell">
        <span className="flex items-center gap-2">
          {entry.kind === 'expense' && (
            <Badge variant="secondary">{categoryLabel(entry.category)}</Badge>
          )}
          <span className="truncate" title={detail}>
            {detail}
          </span>
        </span>
      </TableCell>
      <TableCell className="text-right">
        {entry.kind === 'payment' ? (
          // The description already says who paid whom.
          <span className="font-semibold tabular-nums">
            {formatMoney(entry.amountCents, entry.currency)}
          </span>
        ) : (
          <span
            className={cn(
              'block truncate font-semibold tabular-nums',
              entry.effectCents > 0 ? 'text-positive' : 'text-destructive',
            )}
          >
            {entry.effectCents > 0 ? `${friendName} owes ` : 'You owe '}
            {formatMoney(Math.abs(entry.effectCents), entry.currency)}
          </span>
        )}
      </TableCell>
      <TableCell>
        <span className="flex justify-end gap-1">
          <EditDialog
            label={`Edit ${title}`}
            title={entry.kind === 'expense' ? 'Edit expense' : 'Edit payment'}
            description={
              friend.status === 'linked'
                ? `${friendName} sees this ${entry.kind} too, and will be told about the change.`
                : undefined
            }
          >
            {(close) =>
              entry.kind === 'expense' ? (
                <ExpenseForm friend={friend} entry={entry} onSaved={close} />
              ) : (
                <PaymentForm friend={friend} entry={entry} onSaved={close} />
              )
            }
          </EditDialog>
          <ConfirmAction
            title={`Delete “${title}”?`}
            description="Balances will be updated. This can’t be undone."
            onConfirm={async () => Boolean(await run({ entryId: entry.id }))}
            trigger={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete ${title}`}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 />
              </Button>
            }
          />
        </span>
      </TableCell>
    </TableRow>
  )
}

type ExpenseEntry = Extract<FriendEntry, { kind: 'expense' }>
type PaymentEntry = Extract<FriendEntry, { kind: 'payment' }>

// Starts from `initial` (an edited entry's currency), else a currency this
// friend already has a balance in, then the one picked in Settings (read
// after hydration).
function useDefaultCurrency(friend: Friend, initial?: Currency) {
  const fromBalance = Object.keys(friend.balances)[0] as Currency | undefined
  const [currency, setCurrency] = useState<Currency>(initial ?? fromBalance ?? 'USD')
  useEffect(() => {
    if (!initial && !fromBalance) setCurrency(readPreferences().defaultCurrency)
  }, [initial, fromBalance])
  return [currency, setCurrency] as const
}

/** Adds a shared expense, or with `entry`, edits it. Calls `onSaved` once saved. */
function ExpenseForm({
  friend,
  entry,
  onSaved,
}: {
  friend: Friend
  entry?: ExpenseEntry
  onSaved?: () => void
}) {
  const id = useId()
  const addExpense = useConvexMutation(api.friends.addExpense)
  const updateExpense = useConvexMutation(api.friends.updateExpense)
  const { run, pending, error, setError } = useAction(
    async (input: FriendExpenseInput, receipt: ReceiptValue) =>
      entry
        ? updateExpense({ entryId: entry.id, ...input, receiptId: receipt?.id ?? null })
        : addExpense({ friendId: friend.id, ...input, receiptId: receipt?.id }),
    { success: entry ? 'Expense updated' : 'Expense added' },
  )
  const [description, setDescription] = useState(entry?.description ?? '')
  const [amount, setAmount] = useState(entry ? (entry.amountCents / 100).toFixed(2) : '')
  const [currency, setCurrency] = useDefaultCurrency(friend, entry?.currency)
  const [category, setCategory] = useState<Category>(entry?.category ?? 'food')
  const [date, setDate] = useState(entry?.date ?? todayIsoDate)
  const [paidBy, setPaidBy] = useState<'me' | 'friend'>(entry?.paidBy ?? 'me')
  const [split, setSplit] = useState<'equal' | 'full'>(entry?.split ?? 'equal')
  const [receipt, setReceipt] = useState<ReceiptValue>(() => existingReceipt(entry?.receiptId))
  const other = paidBy === 'me' ? friend.name : 'You'

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const amountCents = parseAmountToCents(amount)
    if (amountCents === null) {
      setError('Enter an amount like 12.50')
      return
    }
    const parsed = friendExpenseInput.safeParse({
      description,
      amountCents,
      currency,
      category,
      paidBy,
      split,
      date,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form')
      return
    }
    if (await run(parsed.data, receipt)) onSaved?.()
  }

  return (
    <form noValidate onSubmit={onSubmit}>
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor={`${id}-description`}>Description</FieldLabel>
          <Input
            id={`${id}-description`}
            value={description}
            maxLength={80}
            placeholder="Dinner"
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-[1fr_6.5rem] gap-3">
          <Field>
            <FieldLabel htmlFor={`${id}-amount`}>Amount</FieldLabel>
            <AmountInput id={`${id}-amount`} value={amount} onChange={setAmount} currency={currency} />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-currency`}>Currency</FieldLabel>
            <CurrencySelect id={`${id}-currency`} value={currency} onChange={setCurrency} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor={`${id}-paid-by`}>Paid by</FieldLabel>
            <SelectField
              id={`${id}-paid-by`}
              value={paidBy}
              onChange={setPaidBy}
              options={[
                { value: 'me', label: 'You' },
                { value: 'friend', label: friend.name },
              ]}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-split`}>Split</FieldLabel>
            <SelectField
              id={`${id}-split`}
              value={split}
              onChange={setSplit}
              options={[
                { value: 'equal', label: 'Equally' },
                { value: 'full', label: `${other} owe${other === 'You' ? '' : 's'} all` },
              ]}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor={`${id}-category`}>Category</FieldLabel>
            <CategorySelect id={`${id}-category`} value={category} onChange={setCategory} />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-date`}>Date</FieldLabel>
            <DatePicker id={`${id}-date`} value={date} onChange={setDate} />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor={`${id}-receipt`}>Receipt</FieldLabel>
          <ReceiptField id={`${id}-receipt`} value={receipt} onChange={setReceipt} />
        </Field>
        {error && <FieldError>{error}</FieldError>}
        <Button type="submit" size="lg" disabled={pending}>
          {pending && <Spinner />}
          {entry ? 'Save changes' : 'Add expense'}
        </Button>
      </FieldGroup>
    </form>
  )
}

/**
 * Records a settle-up payment, or with `entry`, edits it. A new payment
 * starts from the outstanding balance in its currency.
 */
function PaymentForm({
  friend,
  entry,
  onSaved,
}: {
  friend: Friend
  entry?: PaymentEntry
  onSaved?: () => void
}) {
  const id = useId()
  const addPayment = useConvexMutation(api.friends.addPayment)
  const updatePayment = useConvexMutation(api.friends.updatePayment)
  const { run, pending, error, setError } = useAction(
    async (input: FriendPaymentInput) =>
      entry
        ? updatePayment({ entryId: entry.id, ...input })
        : addPayment({ friendId: friend.id, ...input }),
    { success: entry ? 'Payment updated' : 'Payment recorded' },
  )
  const [currency, setCurrency] = useDefaultCurrency(friend, entry?.currency)
  const outstanding = friend.balances[currency] ?? 0
  // Whoever owes pays; default to clearing the whole balance.
  const [paidBy, setPaidBy] = useState<'me' | 'friend'>(
    entry?.paidBy ?? (outstanding < 0 ? 'me' : 'friend'),
  )
  const [amount, setAmount] = useState(
    entry
      ? (entry.amountCents / 100).toFixed(2)
      : outstanding
        ? (Math.abs(outstanding) / 100).toFixed(2)
        : '',
  )
  const [date, setDate] = useState(entry?.date ?? todayIsoDate)
  const [note, setNote] = useState(entry?.note ?? '')

  function pickCurrency(next: Currency) {
    setCurrency(next)
    if (entry) return
    const balance = friend.balances[next] ?? 0
    setPaidBy(balance < 0 ? 'me' : 'friend')
    setAmount(balance ? (Math.abs(balance) / 100).toFixed(2) : '')
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const amountCents = parseAmountToCents(amount)
    if (amountCents === null) {
      setError('Enter an amount like 12.50')
      return
    }
    const parsed = friendPaymentInput.safeParse({
      amountCents,
      currency,
      paidBy,
      note: note || undefined,
      date,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form')
      return
    }
    if (await run(parsed.data)) onSaved?.()
  }

  return (
    <form noValidate onSubmit={onSubmit}>
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor={`${id}-paid-by`}>Who paid?</FieldLabel>
          <SelectField
            id={`${id}-paid-by`}
            value={paidBy}
            onChange={setPaidBy}
            options={[
              { value: 'me', label: `You paid ${friend.name}` },
              { value: 'friend', label: `${friend.name} paid you` },
            ]}
          />
        </Field>
        <div className="grid grid-cols-[1fr_6.5rem] gap-3">
          <Field>
            <FieldLabel htmlFor={`${id}-amount`}>Amount</FieldLabel>
            <AmountInput id={`${id}-amount`} value={amount} onChange={setAmount} currency={currency} />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-currency`}>Currency</FieldLabel>
            <CurrencySelect id={`${id}-currency`} value={currency} onChange={pickCurrency} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor={`${id}-date`}>Date</FieldLabel>
            <DatePicker id={`${id}-date`} value={date} onChange={setDate} />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-note`}>Note</FieldLabel>
            <Input
              id={`${id}-note`}
              value={note}
              maxLength={80}
              placeholder="Bank transfer"
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
        </div>
        {error && <FieldError>{error}</FieldError>}
        <Button type="submit" size="lg" disabled={pending}>
          {pending && <Spinner />}
          {entry ? 'Save changes' : 'Record payment'}
        </Button>
      </FieldGroup>
    </form>
  )
}

function SendRequest({ friendId, email }: { friendId: Friend['id']; email: string }) {
  const requestLink = useConvexMutation(api.friends.requestLink)
  const { run, pending } = useAction(requestLink, {
    success: `Friend request sent to ${email}`,
    toastErrors: true,
  })
  return (
    <Button variant="outline" size="lg" disabled={pending} onClick={() => void run({ friendId })}>
      {pending ? <Spinner /> : <UserPlus />}
      Send friend request
    </Button>
  )
}

function RemoveFriend({ friend }: { friend: Friend }) {
  const removeFriend = useConvexMutation(api.friends.remove)
  const router = useAppRouter()
  const { run } = useAction(removeFriend, {
    success: `${friend.name} removed`,
    toastErrors: true,
  })

  return (
    <ConfirmAction
      title={`Remove ${friend.name}?`}
      description={
        friend.status === 'linked'
          ? `This removes ${friend.name} and your copy of your shared history. They keep theirs. It can’t be undone.`
          : 'This deletes every expense and payment between you. It can’t be undone.'
      }
      confirmLabel="Remove"
      onConfirm={async () => {
        if (!(await run({ friendId: friend.id }))) return false
        router.push('/friends')
        return true
      }}
      trigger={
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label={`Remove ${friend.name}`}
          title="Remove friend"
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 />
        </Button>
      }
    />
  )
}
