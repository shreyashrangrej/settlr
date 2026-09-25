import { useEffect, useState } from 'react'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import {
  Link,
  createFileRoute,
  notFound,
  stripSearchParams,
  useNavigate,
} from '@tanstack/react-router'
import { HandCoins, Receipt, Trash2 } from 'lucide-react'

import { Avatar, BalanceText, FormError, useAction } from '#/components/ledger'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { NativeSelect } from '#/components/ui/native-select'
import {
  CategorySelect,
  CurrencySelect,
  Field,
} from '#/components/form-fields'
import {
  categoryLabel,
  formatDate,
  formatMoney,
  parseAmountToCents,
  todayIsoDate,
} from '#/lib/format'
import { readPreferences } from '#/lib/preferences'
import {
  LIST_STEP,
  friendExpenseInput,
  friendPaymentInput,
  listSearchDefaults,
  listSearchSchema,
  type Category,
  type Currency,
} from '#/lib/schemas'
import type { Friend, FriendEntry } from '#/lib/types'
import { cn } from '#/lib/utils'
import { api } from '#convex/_generated/api'

// SSR: full. The friend and their ledger are prefetched during SSR, then
// stay live. `limit` (the "show more" size) lives in the URL.
export const Route = createFileRoute('/_app/friends/$friendId')({
  validateSearch: listSearchSchema,
  search: { middlewares: [stripSearchParams(listSearchDefaults)] },
  loaderDeps: ({ search }) => search,
  loader: async ({ context, params, deps }) => {
    const [friend] = await Promise.all([
      context.queryClient.ensureQueryData(
        convexQuery(api.friends.get, { friendId: params.friendId }),
      ),
      context.queryClient.ensureQueryData(
        convexQuery(api.friends.entries, {
          friendId: params.friendId,
          limit: deps.limit,
        }),
      ),
    ])
    if (!friend) throw notFound()
    return { name: friend.name }
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `${loaderData.name} · Settlr` }] : [],
  }),
  component: FriendPage,
})

type Panel = 'expense' | 'payment'

function FriendPage() {
  const { friendId } = Route.useParams()
  const { limit } = Route.useSearch()
  const { data: friend } = useSuspenseQuery(
    convexQuery(api.friends.get, { friendId }),
  )
  const { data: ledger } = useSuspenseQuery(
    convexQuery(api.friends.entries, { friendId, limit }),
  )
  const [panel, setPanel] = useState<Panel>('expense')

  // Deleted while open (here or in another tab).
  if (!friend) {
    return (
      <p className="empty">
        This friend was removed. <Link to="/friends">Back to friends</Link>
      </p>
    )
  }

  return (
    <>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Avatar name={friend.name} />
          <div>
            <p className="eyebrow">
              <Link to="/friends">Friends</Link> /
            </p>
            <h1 className="m-0">{friend.name}</h1>
            {friend.email && <p className="muted">{friend.email}</p>}
          </div>
        </div>
        <div className="text-right text-lg font-semibold">
          <BalanceText balances={friend.balances} them={friend.name} />
        </div>
      </div>

      <div className="group-layout">
        <section aria-labelledby="activity-heading" className="grid gap-3">
          <h2 id="activity-heading" className="m-0">
            Activity
          </h2>
          {ledger.items.length === 0 ? (
            <p className="empty">
              Nothing yet. Add an expense you shared with {friend.name}.
            </p>
          ) : (
            <ul className="expense-list">
              {ledger.items.map((entry) => (
                <EntryRow key={entry.id} entry={entry} friendName={friend.name} />
              ))}
            </ul>
          )}
          {ledger.hasMore && (
            <Link
              from={Route.fullPath}
              search={(prev) => ({ ...prev, limit: prev.limit + LIST_STEP })}
              resetScroll={false}
              className="button justify-self-center"
            >
              Show more
            </Link>
          )}
        </section>

        <aside className="card grid gap-4">
          <div className="tabs m-0" role="tablist" aria-label="Record">
            {(
              [
                ['expense', 'Add expense', Receipt],
                ['payment', 'Settle up', HandCoins],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={panel === key}
                data-status={panel === key ? 'active' : undefined}
                onClick={() => setPanel(key)}
                className={cn(
                  'inline-flex cursor-pointer items-center gap-1.5 border-0 border-b-2 border-transparent bg-transparent px-3 py-2 text-sm text-muted-foreground',
                  panel === key && 'border-primary font-semibold text-foreground',
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
          {panel === 'expense' ? (
            <ExpenseForm friend={friend} />
          ) : (
            <PaymentForm friend={friend} />
          )}
          <RemoveFriend friend={friend} />
        </aside>
      </div>
    </>
  )
}

function EntryRow({
  entry,
  friendName,
}: {
  entry: FriendEntry
  friendName: string
}) {
  const removeEntry = useConvexMutation(api.friends.removeEntry)
  const { run, pending } = useAction(removeEntry)
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
        } · ${categoryLabel(entry.category)}`
      : (entry.note ?? 'Settle-up payment')

  return (
    <li className="expense">
      <div className="min-w-0">
        <p className="expense__title flex items-center gap-2">
          {entry.kind === 'payment' && (
            <HandCoins className="size-4 text-primary" aria-hidden="true" />
          )}
          <span className="truncate">{title}</span>
        </p>
        <p className="muted">
          {formatDate(entry.date)} · {detail}
        </p>
      </div>
      <div className="expense__side">
        {entry.kind === 'payment' ? (
          // The title already says who paid whom.
          <span className="amount text-sm">
            {formatMoney(entry.amountCents, entry.currency)}
          </span>
        ) : (
          <span
            className={cn(
              'amount text-sm',
              entry.effectCents > 0 ? 'positive' : 'negative',
            )}
          >
            {entry.effectCents > 0 ? `${friendName} owes ` : 'You owe '}
            {formatMoney(Math.abs(entry.effectCents), entry.currency)}
          </span>
        )}
        <button
          type="button"
          className="button button--ghost"
          disabled={pending}
          aria-label={`Delete ${title}`}
          onClick={() => {
            if (window.confirm(`Delete “${title}”?`)) {
              void run({ entryId: entry.id })
            }
          }}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </li>
  )
}

// Defaults to a currency this friend already has a balance in, then to the
// currency picked in Settings (read after hydration).
function useDefaultCurrency(friend: Friend) {
  const fromBalance = Object.keys(friend.balances)[0] as Currency | undefined
  const [currency, setCurrency] = useState<Currency>(fromBalance ?? 'USD')
  useEffect(() => {
    if (!fromBalance) setCurrency(readPreferences().defaultCurrency)
  }, [fromBalance])
  return [currency, setCurrency] as const
}

function ExpenseForm({ friend }: { friend: Friend }) {
  const addExpense = useConvexMutation(api.friends.addExpense)
  const { run, pending, error, setError } = useAction(addExpense)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useDefaultCurrency(friend)
  const [category, setCategory] = useState<Category>('food')
  const [date, setDate] = useState(todayIsoDate)
  const [paidBy, setPaidBy] = useState<'me' | 'friend'>('me')
  const [split, setSplit] = useState<'equal' | 'full'>('equal')
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
    if (await run({ friendId: friend.id, ...parsed.data })) {
      setDescription('')
      setAmount('')
    }
  }

  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-3">
      <Field label="Description" htmlFor="fe-description">
        <Input
          id="fe-description"
          value={description}
          maxLength={80}
          placeholder="Dinner"
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <div className="grid grid-cols-[1fr_6rem] gap-2">
        <Field label="Amount" htmlFor="fe-amount">
          <Input
            id="fe-amount"
            inputMode="decimal"
            value={amount}
            placeholder="0.00"
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label="Currency" htmlFor="fe-currency">
          <CurrencySelect id="fe-currency" value={currency} onChange={setCurrency} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Paid by" htmlFor="fe-paid-by">
          <NativeSelect
            id="fe-paid-by"
            value={paidBy}
            onChange={(e) => setPaidBy(e.target.value as 'me' | 'friend')}
          >
            <option value="me">You</option>
            <option value="friend">{friend.name}</option>
          </NativeSelect>
        </Field>
        <Field label="Split" htmlFor="fe-split">
          <NativeSelect
            id="fe-split"
            value={split}
            onChange={(e) => setSplit(e.target.value as 'equal' | 'full')}
          >
            <option value="equal">Equally</option>
            <option value="full">
              {other} owe{other === 'You' ? '' : 's'} it all
            </option>
          </NativeSelect>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Category" htmlFor="fe-category">
          <CategorySelect id="fe-category" value={category} onChange={setCategory} />
        </Field>
        <Field label="Date" htmlFor="fe-date">
          <Input
            id="fe-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
      </div>
      <FormError error={error} />
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Add expense'}
      </Button>
    </form>
  )
}

function PaymentForm({ friend }: { friend: Friend }) {
  const addPayment = useConvexMutation(api.friends.addPayment)
  const { run, pending, error, setError } = useAction(addPayment)
  const [currency, setCurrency] = useDefaultCurrency(friend)
  const outstanding = friend.balances[currency] ?? 0
  // Whoever owes pays; default to clearing the whole balance.
  const [paidBy, setPaidBy] = useState<'me' | 'friend'>(
    outstanding < 0 ? 'me' : 'friend',
  )
  const [amount, setAmount] = useState(
    outstanding ? (Math.abs(outstanding) / 100).toFixed(2) : '',
  )
  const [date, setDate] = useState(todayIsoDate)
  const [note, setNote] = useState('')

  function pickCurrency(next: Currency) {
    setCurrency(next)
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
    if (await run({ friendId: friend.id, ...parsed.data })) {
      setAmount('')
      setNote('')
    }
  }

  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        Record money that changed hands to settle up.
      </p>
      <Field label="Who paid?" htmlFor="fp-paid-by">
        <NativeSelect
          id="fp-paid-by"
          value={paidBy}
          onChange={(e) => setPaidBy(e.target.value as 'me' | 'friend')}
        >
          <option value="me">You paid {friend.name}</option>
          <option value="friend">{friend.name} paid you</option>
        </NativeSelect>
      </Field>
      <div className="grid grid-cols-[1fr_6rem] gap-2">
        <Field label="Amount" htmlFor="fp-amount">
          <Input
            id="fp-amount"
            inputMode="decimal"
            value={amount}
            placeholder="0.00"
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label="Currency" htmlFor="fp-currency">
          <CurrencySelect id="fp-currency" value={currency} onChange={pickCurrency} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Date" htmlFor="fp-date">
          <Input
            id="fp-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label="Note" htmlFor="fp-note">
          <Input
            id="fp-note"
            value={note}
            maxLength={80}
            placeholder="Bank transfer"
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </div>
      <FormError error={error} />
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Record payment'}
      </Button>
    </form>
  )
}

function RemoveFriend({ friend }: { friend: Friend }) {
  const removeFriend = useConvexMutation(api.friends.remove)
  const navigate = useNavigate()
  const { run, pending, error } = useAction(removeFriend)

  return (
    <div className="grid gap-2 border-t pt-4">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="justify-self-start text-muted-foreground hover:text-destructive"
        disabled={pending}
        onClick={async () => {
          if (
            !window.confirm(
              `Remove ${friend.name}? This deletes all of your shared history.`,
            )
          ) {
            return
          }
          if (await run({ friendId: friend.id })) {
            await navigate({ to: '/friends' })
          }
        }}
      >
        <Trash2 />
        Remove friend
      </Button>
      <FormError error={error} />
    </div>
  )
}
