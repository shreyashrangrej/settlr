'use client'

import { useEffect, useId, useState } from 'react'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { CalendarClock, HandCoins, Plus, Receipt, Scale, Trash2, UserPlus, Wallet } from 'lucide-react'

import { CategoryIcon, IconTile } from '#/components/category'
import { ConfirmAction } from '#/components/confirm-action'
import { ExpenseFilters, useListSearch } from '#/components/expense-filters'
import {
  ExpenseRow,
  ExpenseSection,
  ExpenseTable,
  RowActions,
  YourShare,
} from '#/components/expense-list'
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
import { ExpensePage } from '#/components/expense-page'
import { FormDialog } from '#/components/form-dialog'
import { useAppRouter } from '#/components/navigation-progress'
import { PageHeader } from '#/components/page-header'
import {
  ReceiptField,
  ReceiptLink,
  existingReceipt,
  type ReceiptValue,
} from '#/components/receipts'
import { StatCard, StatGrid } from '#/components/stat-card'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '#/components/ui/empty'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Separator } from '#/components/ui/separator'
import { Spinner } from '#/components/ui/spinner'
import {
  categoryLabel,
  formatDate,
  formatMoney,
  parseAmountToCents,
  todayIsoDate,
} from '@settlr/shared/format'
import { readPreferences } from '#/lib/preferences'
import {
  LIST_STEP,
  friendExpenseInput,
  friendPaymentInput,
  friendSearchDefaults,
  isFiltered,
  type Category,
  type Currency,
  type FriendExpenseInput,
  type FriendPaymentInput,
  type FriendSearch,
} from '@settlr/shared/schemas'
import type { Friend, FriendEntry } from '#/lib/types'
import type { FunctionReturnType } from 'convex/server'
import { api } from '@settlr/backend/convex/_generated/api'

type FriendSummary = FunctionReturnType<typeof api.friends.summary>


/**
 * A friend and your one-on-one ledger. The ledger's filters, sorting and
 * length (`search`) live in the URL, like a group's expenses; `search.tab`
 * is the form the side panel starts on.
 */
export function FriendView({ friendId, search }: { friendId: string; search: FriendSearch }) {
  const { tab, ...filter } = search
  const { data: friend } = useSuspenseQuery(
    convexQuery(api.friends.get, { friendId }),
  )
  const { data: summary } = useSuspenseQuery(convexQuery(api.friends.summary, { friendId }))
  const { data: ledger } = useSuspenseQuery(
    convexQuery(api.friends.entries, { friendId, ...filter }),
  )
  const { hrefFor, update, clearHref } = useListSearch(
    `/friends/${friendId}`,
    search,
    friendSearchDefaults,
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
            {friend.email ?? 'One-on-one expenses and payments'}
            <FriendStatusBadge status={friend.status} />
          </span>
        }
        actions={
          <>
            {friend.email && (friend.status === null || friend.status === 'declined') && (
              <SendRequest friendId={friend.id} email={friend.email} />
            )}
            <FormDialog
              trigger={<Button variant="outline" />}
              label={
                <>
                  <HandCoins />
                  Settle up
                </>
              }
              title={`Settle up with ${friend.name}`}
              description="Record a payment between you. It changes the balance, not your spending."
              defaultOpen={tab === 'payment'}
            >
              {(close) => <PaymentForm friend={friend} onSaved={close} />}
            </FormDialog>
            <FormDialog
              trigger={<Button />}
              label={
                <>
                  <Plus />
                  Add expense
                </>
              }
              title={`Add an expense with ${friend.name}`}
            >
              {(close) => <ExpenseForm friend={friend} onSaved={close} />}
            </FormDialog>
          </>
        }
      />

      <ExpensePage
        stats={<FriendStats friend={friend} summary={summary} />}
        aside={
          <>
            <BalanceCard friend={friend} />
          </>
        }
      >
        <ExpenseSection
          filters={
            (ledger.items.length > 0 || isFiltered(filter)) && (
              <ExpenseFilters
                value={filter}
                onChange={update}
                payers={[
                  { value: 'me', label: 'You paid' },
                  { value: 'friend', label: `${friend.name} paid` },
                ]}
              />
            )
          }
          empty={
            ledger.items.length === 0 &&
            (isFiltered(filter)
              ? {
                  icon: <Receipt />,
                  title: 'No matches',
                  description: 'Nothing matches these filters.',
                  clearHref,
                }
              : {
                  icon: <Receipt />,
                  title: 'Nothing yet',
                  description: `Add an expense you shared with ${friend.name}.`,
                })
          }
          more={ledger.hasMore && hrefFor({ ...search, limit: search.limit + LIST_STEP })}
        >
          <ExpenseTable columns={['Paid by', 'Split']}>
            {ledger.items.map((entry) => (
              <EntryRow key={entry.id} entry={entry} friend={friend} />
            ))}
          </ExpenseTable>
        </ExpenseSection>
      </ExpensePage>
    </>
  )
}

/**
 * A friend's figures, in the same order as a group's: what you've shared,
 * where you stand, how many expenses, and when you last added something.
 */
function FriendStats({ friend, summary }: { friend: Friend; summary: FriendSummary }) {
  const balances = Object.entries(friend.balances).filter(
    (entry): entry is [string, number] => Boolean(entry[1]),
  ) as Array<[Currency, number]>
  // The largest balance leads; the tone follows it.
  const [main] = [...balances].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
  const totals = summary?.totals ?? []
  const count = totals.reduce((n, t) => n + t.count, 0)
  const lead = totals[0]
  return (
    <StatGrid>
      <StatCard
        label="Total shared"
        icon={<Wallet />}
        value={totals.map((t) => formatMoney(t.totalCents, t.currency)).join(' + ')}
        hint={lead && `Your share ${formatMoney(lead.shareCents, lead.currency)}`}
      />
      <StatCard
        label="Your balance"
        icon={<Scale />}
        tone={main ? (main[1] > 0 ? 'positive' : 'negative') : undefined}
        value={
          main
            ? balances
                .map(
                  ([currency, cents]) =>
                    `${cents > 0 ? '+' : '−'}${formatMoney(Math.abs(cents), currency)}`,
                )
                .join(' ')
            : 'Square'
        }
        hint={
          main
            ? main[1] > 0
              ? `${friend.name} owes you`
              : `You owe ${friend.name}`
            : 'Nobody owes anything'
        }
      />
      <StatCard
        label="Expenses"
        icon={<Receipt />}
        value={count || ''}
        hint={
          lead && count > 0 && `Avg ${formatMoney(Math.round(lead.totalCents / lead.count), lead.currency)}`
        }
      />
      <StatCard
        label="Last activity"
        icon={<CalendarClock />}
        value={formatDate(new Date(friend.lastActivityAt).toISOString().slice(0, 10))}
      />
    </StatGrid>
  )
}

/**
 * The side card, like a group's Balances card: what's owed in each
 * currency, and removing the friend below a hairline.
 */
function BalanceCard({ friend }: { friend: Friend }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Balance</CardTitle>
        <CardDescription>Expenses minus payments, per currency.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <BalanceText
          balances={friend.balances}
          them={friend.name}
          className="justify-items-start text-sm"
        />
        <Separator />
        <RemoveFriend friend={friend} />
      </CardContent>
    </Card>
  )
}

function EntryRow({ entry, friend }: { entry: FriendEntry; friend: Friend }) {
  const friendName = friend.name
  const removeEntry = useConvexMutation(api.friends.removeEntry)
  const { run } = useAction(removeEntry, {
    success: 'Deleted',
    toastErrors: true,
  })
  const payer = entry.paidBy === 'me' ? 'You' : friendName
  // What it cost you: the payer's share is the amount minus what the other
  // person owes (the effect on the balance); otherwise it's that effect.
  const shareCents =
    entry.paidBy === 'me' ? entry.amountCents - entry.effectCents : -entry.effectCents
  const title =
    entry.kind === 'expense'
      ? entry.description
      : entry.paidBy === 'me'
        ? `You paid ${friendName}`
        : `${friendName} paid you`

  return (
    <ExpenseRow
      icon={
        entry.kind === 'expense' ? (
          <CategoryIcon category={entry.category} />
        ) : (
          <IconTile className="text-primary">
            <HandCoins />
          </IconTile>
        )
      }
      title={title}
      receipt={
        entry.kind === 'expense' &&
        entry.receiptId && <ReceiptLink source="friend" expenseId={entry.id} />
      }
      subtitle={
        entry.kind === 'expense' ? categoryLabel(entry.category) : (entry.note ?? 'Settle-up payment')
      }
      date={entry.date}
      cells={
        entry.kind === 'expense'
          ? [
              { value: payer, folded: `${payer} paid` },
              entry.split === 'equal' ? 'Equally' : 'Owed in full',
            ]
          : // The title already says who paid whom, so nothing folds.
            [
              { value: payer, folded: null },
              { value: 'Payment', folded: null },
            ]
      }
      amount={
        <>
          <span>{formatMoney(entry.amountCents, entry.currency)}</span>
          {entry.kind === 'expense' && shareCents !== entry.amountCents && (
            <YourShare cents={formatMoney(shareCents, entry.currency)} />
          )}
        </>
      }
      actions={
        <RowActions
          name={title}
          edit={{
            title: entry.kind === 'expense' ? 'Edit expense' : 'Edit payment',
            description:
              friend.status === 'linked'
                ? `${friendName} sees this ${entry.kind} too, and will be told about the change.`
                : undefined,
            form: (close) =>
              entry.kind === 'expense' ? (
                <ExpenseForm friend={friend} entry={entry} onSaved={close} />
              ) : (
                <PaymentForm friend={friend} entry={entry} onSaved={close} />
              ),
          }}
          deleteDescription="Balances will be updated. This can’t be undone."
          onDelete={async () => Boolean(await run({ entryId: entry.id }))}
        />
      }
    />
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

/** Adds a shared expense, or with `entry`, edits it. */
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
    if (!(await run(parsed.data, receipt))) return
    // A dialog closes once saved (edits always, adds from the header).
    if (onSaved) {
      onSaved()
      return
    }
    setDescription('')
    setAmount('')
    setReceipt(null)
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
        <Button type="submit" disabled={pending}>
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
    if (!(await run(parsed.data))) return
    // A dialog closes once saved (edits always, adds from the header).
    if (onSaved) {
      onSaved()
      return
    }
    setAmount('')
    setNote('')
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
          <FieldDescription>Record money that changed hands.</FieldDescription>
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
        <Button type="submit" disabled={pending}>
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
    <Button variant="outline" disabled={pending} onClick={() => void run({ friendId })}>
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
          size="sm"
          className="-ml-2 justify-self-start text-muted-foreground hover:text-destructive"
        >
          <Trash2 />
          Remove friend
        </Button>
      }
    />
  )
}
