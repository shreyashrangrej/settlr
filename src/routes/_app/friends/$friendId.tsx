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

import { ConfirmAction } from '#/components/confirm-action'
import {
  AmountInput,
  CategorySelect,
  CurrencySelect,
  SelectField,
} from '#/components/form-fields'
import { BalanceText, PersonAvatar, useAction } from '#/components/ledger'
import { PageHeader, SplitLayout } from '#/components/page-header'
import { Badge } from '#/components/ui/badge'
import { Button, buttonVariants } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { Spinner } from '#/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
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

function FriendPage() {
  const { friendId } = Route.useParams()
  const { limit } = Route.useSearch()
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
            <Link to="/friends">Back to friends</Link>
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow={<Link to="/friends">Friends</Link>}
        media={<PersonAvatar name={friend.name} size="lg" />}
        title={friend.name}
        description={friend.email ?? undefined}
        actions={
          <BalanceText
            balances={friend.balances}
            them={friend.name}
            className="text-right text-lg"
          />
        }
      />

      <SplitLayout
        aside={
          <>
            <Card>
              <CardContent>
                <Tabs defaultValue="expense">
                  <TabsList className="mb-4 w-full">
                    <TabsTrigger value="expense">
                      <Receipt />
                      Add expense
                    </TabsTrigger>
                    <TabsTrigger value="payment">
                      <HandCoins />
                      Settle up
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="expense">
                    <ExpenseForm friend={friend} />
                  </TabsContent>
                  <TabsContent value="payment">
                    <PaymentForm friend={friend} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
            <RemoveFriend friend={friend} />
          </>
        }
      >
        <Card className="py-2">
          <CardHeader className="px-4 pt-2">
            <CardTitle>Activity</CardTitle>
          </CardHeader>
          <CardContent className="px-2">
            {ledger.items.length === 0 ? (
              <Empty className="py-8">
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="hidden md:table-cell">Date</TableHead>
                    <TableHead className="hidden lg:table-cell">Details</TableHead>
                    <TableHead className="text-right">Effect</TableHead>
                    <TableHead className="w-10">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.items.map((entry) => (
                    <EntryRow key={entry.id} entry={entry} friendName={friend.name} />
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        {ledger.hasMore && (
          <Link
            from={Route.fullPath}
            search={(prev) => ({ ...prev, limit: prev.limit + LIST_STEP })}
            resetScroll={false}
            className={cn(buttonVariants({ variant: 'outline' }), 'justify-self-center no-underline')}
          >
            Show more
          </Link>
        )}
      </SplitLayout>
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
      <TableCell className="max-w-0">
        <span className="flex items-center gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted [&_svg]:size-4">
            {entry.kind === 'payment' ? (
              <HandCoins className="text-primary" />
            ) : (
              <Receipt className="text-muted-foreground" />
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium">{title}</span>
            <span className="block truncate text-xs text-muted-foreground lg:hidden">
              <span className="md:hidden">{formatDate(entry.date)} · </span>
              {detail}
            </span>
          </span>
        </span>
      </TableCell>
      <TableCell className="hidden w-36 text-muted-foreground md:table-cell">
        {formatDate(entry.date)}
      </TableCell>
      <TableCell className="hidden max-w-0 text-muted-foreground lg:table-cell">
        <span className="flex items-center gap-2">
          {entry.kind === 'expense' && (
            <Badge variant="secondary">{categoryLabel(entry.category)}</Badge>
          )}
          <span className="truncate">{detail}</span>
        </span>
      </TableCell>
      <TableCell className="w-44 text-right">
        {entry.kind === 'payment' ? (
          // The description already says who paid whom.
          <span className="font-semibold tabular-nums">
            {formatMoney(entry.amountCents, entry.currency)}
          </span>
        ) : (
          <span
            className={cn(
              'font-semibold tabular-nums',
              entry.effectCents > 0 ? 'text-positive' : 'text-destructive',
            )}
          >
            {entry.effectCents > 0 ? `${friendName} owes ` : 'You owe '}
            {formatMoney(Math.abs(entry.effectCents), entry.currency)}
          </span>
        )}
      </TableCell>
      <TableCell className="w-10 text-right">
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
      </TableCell>
    </TableRow>
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
  const { run, pending, error, setError } = useAction(addExpense, {
    success: 'Expense added',
  })
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
    <form noValidate onSubmit={onSubmit}>
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor="fe-description">Description</FieldLabel>
          <Input
            id="fe-description"
            value={description}
            maxLength={80}
            placeholder="Dinner"
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-[1fr_6.5rem] gap-3">
          <Field>
            <FieldLabel htmlFor="fe-amount">Amount</FieldLabel>
            <AmountInput id="fe-amount" value={amount} onChange={setAmount} currency={currency} />
          </Field>
          <Field>
            <FieldLabel htmlFor="fe-currency">Currency</FieldLabel>
            <CurrencySelect id="fe-currency" value={currency} onChange={setCurrency} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="fe-paid-by">Paid by</FieldLabel>
            <SelectField
              id="fe-paid-by"
              value={paidBy}
              onChange={setPaidBy}
              options={[
                { value: 'me', label: 'You' },
                { value: 'friend', label: friend.name },
              ]}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="fe-split">Split</FieldLabel>
            <SelectField
              id="fe-split"
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
            <FieldLabel htmlFor="fe-category">Category</FieldLabel>
            <CategorySelect id="fe-category" value={category} onChange={setCategory} />
          </Field>
          <Field>
            <FieldLabel htmlFor="fe-date">Date</FieldLabel>
            <Input
              id="fe-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        </div>
        {error && <FieldError>{error}</FieldError>}
        <Button type="submit" size="lg" disabled={pending}>
          {pending && <Spinner />}
          Add expense
        </Button>
      </FieldGroup>
    </form>
  )
}

function PaymentForm({ friend }: { friend: Friend }) {
  const addPayment = useConvexMutation(api.friends.addPayment)
  const { run, pending, error, setError } = useAction(addPayment, {
    success: 'Payment recorded',
  })
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
    <form noValidate onSubmit={onSubmit}>
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor="fp-paid-by">Who paid?</FieldLabel>
          <SelectField
            id="fp-paid-by"
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
            <FieldLabel htmlFor="fp-amount">Amount</FieldLabel>
            <AmountInput id="fp-amount" value={amount} onChange={setAmount} currency={currency} />
          </Field>
          <Field>
            <FieldLabel htmlFor="fp-currency">Currency</FieldLabel>
            <CurrencySelect id="fp-currency" value={currency} onChange={pickCurrency} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="fp-date">Date</FieldLabel>
            <Input
              id="fp-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="fp-note">Note</FieldLabel>
            <Input
              id="fp-note"
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
          Record payment
        </Button>
      </FieldGroup>
    </form>
  )
}

function RemoveFriend({ friend }: { friend: Friend }) {
  const removeFriend = useConvexMutation(api.friends.remove)
  const navigate = useNavigate()
  const { run } = useAction(removeFriend, {
    success: `${friend.name} removed`,
    toastErrors: true,
  })

  return (
    <ConfirmAction
      title={`Remove ${friend.name}?`}
      description="This deletes every expense and payment between you. It can’t be undone."
      confirmLabel="Remove"
      onConfirm={async () => {
        if (!(await run({ friendId: friend.id }))) return false
        await navigate({ to: '/friends' })
        return true
      }}
      trigger={
        <Button
          variant="ghost"
          className="justify-self-start text-muted-foreground hover:text-destructive"
        >
          <Trash2 />
          Remove friend
        </Button>
      }
    />
  )
}
