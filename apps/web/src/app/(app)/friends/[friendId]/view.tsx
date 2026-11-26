'use client'

import { useId, useState } from 'react'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import Link from 'next/link'
import {
  BellRing,
  CalendarClock,
  Check,
  CircleAlert,
  HandCoins,
  Layers,
  Plus,
  Receipt,
  Scale,
  Trash2,
  UserPlus,
  Wallet,
  X,
} from 'lucide-react'

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
import { ExpenseDialog, useFriendCurrency } from '#/components/expense-dialog'
import { ExpensePage } from '#/components/expense-page'
import { FormDialog } from '#/components/form-dialog'
import { useAppRouter } from '#/components/navigation-progress'
import { PageHeader } from '#/components/page-header'
import { ReceiptLink } from '#/components/receipts'
import { StatCard, StatGrid } from '#/components/stat-card'
import { UNDO_DESCRIPTION, useDeleteWithUndo } from '#/components/undo'
import { UpiPay } from '#/components/upi'
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
import { toast } from 'sonner'
import {
  LIST_STEP,
  friendPaymentInput,
  friendSearchDefaults,
  isFiltered,
  type Currency,
  type FriendPaymentInput,
  type FriendSearch,
} from '@settlr/shared/schemas'
import type { Friend, FriendEntry } from '#/lib/types'
import type { FunctionReturnType } from 'convex/server'
import { api } from '@settlr/backend/convex/_generated/api'

type FriendSummary = FunctionReturnType<typeof api.friends.summary>
type FriendDetail = NonNullable<FunctionReturnType<typeof api.friends.get>>


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
            {Object.values(friend.balances).some((c) => (c ?? 0) > 0) &&
              (friend.status === 'linked' || friend.email) && <RemindButton friend={friend} />}
            {friend.upiId && (friend.balances.INR ?? 0) < 0 && (
              <UpiPay
                upiId={friend.upiId}
                name={friend.name}
                amountCents={-(friend.balances.INR ?? 0)}
              />
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
            <ExpenseDialog target={{ kind: 'friend', friend }} trigger={<Button />}>
              <Plus />
              Add expense
            </ExpenseDialog>
          </>
        }
      />

      <ExpensePage
        stats={<FriendStats friend={friend} summary={summary} />}
        aside={
          <>
            <ConfirmCard friend={friend} entries={ledger.items} />
            <BalanceCard friend={friend} />
            {friend.status === 'linked' && <AcrossCard friend={friend} />}
            {friend.status !== 'linked' && <UpiCard friend={friend} />}
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
  const removeEntry = useDeleteWithUndo(useConvexMutation(api.friends.removeEntry))
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
      tags={entry.kind === 'expense' ? entry.tags : undefined}
      receipt={
        entry.kind === 'expense' &&
        entry.receiptId && <ReceiptLink source="friend" expenseId={entry.id} />
      }
      subtitle={
        entry.kind === 'expense' ? (
          categoryLabel(entry.category)
        ) : entry.unconfirmed ? (
          <PaymentStatus entry={entry} />
        ) : (
          (entry.note ?? 'Settle-up payment')
        )
      }
      date={entry.date}
      cells={
        entry.kind === 'expense'
          ? [
              { value: payer, folded: `${payer} paid` },
              entry.split === 'equal'
                ? 'Equally'
                : entry.split === 'exact'
                  ? 'By amount'
                  : 'Owed in full',
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
          edit={
            entry.kind === 'expense'
              ? {
                  dialog: (state) => (
                    <ExpenseDialog target={{ kind: 'friend', friend, expense: entry }} {...state} />
                  ),
                }
              : {
                  title: 'Edit payment',
                  description:
                    friend.status === 'linked'
                      ? `${friendName} sees this payment too, and will be told about the change.`
                      : undefined,
                  form: (close) => <PaymentForm friend={friend} entry={entry} onSaved={close} />,
                }
          }
          deleteDescription={
            entry.kind === 'expense'
              ? UNDO_DESCRIPTION
              : 'Balances will be updated. This can’t be undone.'
          }
          onDelete={() => removeEntry({ entryId: entry.id })}
        />
      }
    />
  )
}

type PaymentEntry = Extract<FriendEntry, { kind: 'payment' }>

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
  const [currency, setCurrency] = useFriendCurrency(friend, entry?.currency)
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

function PaymentStatus({ entry }: { entry: PaymentEntry }) {
  return (
    <span className="inline-flex items-center gap-1 text-warning">
      <CircleAlert className="size-3" aria-hidden="true" />
      {entry.canConfirm ? 'Confirm you got it' : 'Waiting for them to confirm'}
    </span>
  )
}

/** Payments a linked friend says they made to you, waiting for your answer. */
function ConfirmCard({ friend, entries }: { friend: Friend; entries: Array<FriendEntry> }) {
  const answer = useAction(useConvexMutation(api.friends.answerPayment), { toastErrors: true })
  const waiting = entries.filter(
    (e): e is PaymentEntry => e.kind === 'payment' && e.canConfirm,
  )
  if (waiting.length === 0) return null
  return (
    <Card className="border-warning/50">
      <CardHeader>
        <CardTitle>Did you get paid?</CardTitle>
        <CardDescription>
          {friend.name} recorded {waiting.length === 1 ? 'a payment' : 'payments'} to you.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {waiting.map((e) => (
          <div key={e.id} className="grid gap-2">
            <p className="m-0 text-sm">
              <span className="font-medium tabular-nums">{formatMoney(e.amountCents, e.currency)}</span>{' '}
              on {formatDate(e.date)}
              {e.note && <span className="text-muted-foreground"> · {e.note}</span>}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={answer.pending}
                onClick={async () => {
                  if (await answer.run({ entryId: e.id, confirm: true })) {
                    toast.success('Payment confirmed')
                  }
                }}
              >
                <Check />
                Got it
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={answer.pending}
                onClick={async () => {
                  if (await answer.run({ entryId: e.id, confirm: false })) {
                    toast.success('Payment removed')
                  }
                }}
              >
                <X />
                Didn’t get it
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function RemindButton({ friend }: { friend: FriendDetail }) {
  const remind = useConvexMutation(api.friends.remind)
  const { run, pending } = useAction(remind, { toastErrors: true })
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={async () => {
        const sent = await run({ friendId: friend.id })
        if (sent) {
          toast.success(
            sent.value === 'email' ? `Reminder emailed to ${friend.name}` : `${friend.name} was reminded`,
          )
        }
      }}
    >
      {pending ? <Spinner /> : <BellRing />}
      Remind
    </Button>
  )
}

/**
 * Where you stand with a linked friend across your one-on-one ledger and
 * every group you share, with one button to settle it all.
 */
function AcrossCard({ friend }: { friend: Friend }) {
  // Not prefetched: it only shows for linked friends who share groups.
  const { data } = useQuery(convexQuery(api.friends.overview, { friendId: friend.id }))
  const settle = useAction(useConvexMutation(api.friends.settleEverything), {
    toastErrors: true,
  })
  if (!data || data.groups.length === 0) return null
  const totals = Object.entries(data.totals) as Array<[Currency, number]>
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="size-4 text-muted-foreground" />
          Across everything
        </CardTitle>
        <CardDescription>This ledger plus the groups you share.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <ul className="m-0 grid list-none gap-1.5 p-0">
          {Object.entries(data.direct).map(([code, cents]) => (
            <li key={`d-${code}`} className="flex justify-between gap-2">
              <span className="text-muted-foreground">One-on-one</span>
              <SignedText cents={cents} currency={code as Currency} />
            </li>
          ))}
          {data.groups.map((g) => (
            <li key={g.groupId} className="flex justify-between gap-2">
              <Link href={`/groups/${g.groupId}`} className="truncate text-muted-foreground">
                {g.name}
              </Link>
              <SignedText cents={g.cents} currency={g.currency} />
            </li>
          ))}
        </ul>
        <Separator />
        {totals.length === 0 ? (
          <p className="m-0 text-muted-foreground">It all cancels out.</p>
        ) : (
          totals.map(([code, cents]) => (
            <div key={code} className="grid gap-2">
              <p className="m-0 font-medium">
                {cents > 0
                  ? `${friend.name} owes you ${formatMoney(cents, code)} in all`
                  : `You owe ${friend.name} ${formatMoney(-cents, code)} in all`}
              </p>
              <ConfirmAction
                title={`Settle everything in ${code}?`}
                description={`This records a payment in your one-on-one ledger and in each shared group, so all of it is square.${cents < 0 ? ` ${friend.name} is asked to confirm the payments you make.` : ''}`}
                confirmLabel="Settle everything"
                destructive={false}
                onConfirm={async () => {
                  const done = await settle.run({
                    friendId: friend.id,
                    currency: code,
                    date: todayIsoDate(),
                  })
                  if (done) toast.success(`Recorded ${done.value} payments`)
                  return Boolean(done)
                }}
                trigger={
                  <Button variant="contrast" size="sm" className="justify-self-start">
                    <HandCoins />
                    Settle everything
                  </Button>
                }
              />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function SignedText({ cents, currency }: { cents: number; currency: Currency }) {
  return (
    <span className={cents > 0 ? 'text-positive tabular-nums' : 'text-destructive tabular-nums'}>
      {cents > 0 ? '+' : '−'}
      {formatMoney(Math.abs(cents), currency)}
    </span>
  )
}

/** The UPI id you pay an unlinked friend at (linked friends set their own). */
function UpiCard({ friend }: { friend: FriendDetail }) {
  const id = useId()
  const [value, setValue] = useState(friend.ownUpiId ?? '')
  const save = useAction(useConvexMutation(api.friends.setUpi), {
    success: 'UPI id saved',
    toastErrors: true,
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle>UPI</CardTitle>
        <CardDescription>Their UPI id, for paying them from your phone.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void save.run({ friendId: friend.id, upiId: value.trim() || null })
          }}
        >
          <label htmlFor={`${id}-upi`} className="sr-only">
            UPI id
          </label>
          <Input
            id={`${id}-upi`}
            value={value}
            placeholder="name@bank"
            maxLength={100}
            onChange={(e) => setValue(e.target.value)}
          />
          <Button type="submit" variant="outline" disabled={save.pending}>
            Save
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
