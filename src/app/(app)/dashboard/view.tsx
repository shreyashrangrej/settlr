'use client'

import { useEffect, useState } from 'react'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { ArrowDownLeft, ArrowUpRight, Plus, Users, Zap } from 'lucide-react'

import { AddMenu } from '#/components/add-menu'
import { budgetStatus, type Spending } from '#/components/budget'
import { CategoryIcon, groupColor } from '#/components/category'
import { SelectField } from '#/components/form-fields'
import { GroupTile } from '#/components/group-tile'
import { PersonAvatar, sumBalances, useAction } from '#/components/ledger'
import { NotificationBell } from '#/components/notification-bell'
import { PageHeader } from '#/components/page-header'
import { useSession } from '#/components/providers'
import { Button, buttonVariants } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Skeleton } from '#/components/ui/skeleton'
import { Spinner } from '#/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import {
  categoryLabel,
  formatDate,
  formatLongDate,
  formatMoney,
  formatMonth,
  parseAmountToCents,
  plural,
} from '#/lib/format'
import { addExpenseInput, type Currency } from '#/lib/schemas'
import type { Friend, GroupSummary, PersonalMonth } from '#/lib/types'
import { cn } from '#/lib/utils'
import { api } from '#convex/_generated/api'

const PREVIEW = 5
const MAX_BALANCES = 8

const card = 'flex min-w-0 flex-col rounded-3xl border bg-card'
const cardTitle = 'm-0 text-base font-semibold tracking-[-0.02em]'
const cardLink =
  'text-[0.8125rem] font-medium text-muted-foreground no-underline hover:text-primary'
const fieldLabel = 'text-xs text-muted-foreground'

// One line in the balances list: a friend (per currency) or a group you
// aren't square in. Positive `cents` is owed to you.
type Balance = {
  key: string
  name: string
  sub: string
  href: string
  cents: number
  currency: Currency
  color?: string
}

function toBalances(friends: Array<Friend>, groups: Array<GroupSummary>) {
  const rows: Array<Balance> = []
  for (const friend of friends) {
    for (const [currency, cents] of Object.entries(friend.balances)) {
      if (!cents) continue
      rows.push({
        key: `f:${friend.id}:${currency}`,
        name: friend.name,
        sub: 'Friend',
        href: `/friends/${friend.id}`,
        cents,
        currency: currency as Currency,
      })
    }
  }
  for (const group of groups) {
    if (!group.myNetCents) continue
    rows.push({
      key: `g:${group.id}`,
      name: group.name,
      sub: `Group · ${plural(group.memberCount, 'person', 'people')}`,
      href: `/groups/${group.id}`,
      cents: group.myNetCents,
      currency: group.currency,
      color: groupColor(group.id),
    })
  }
  return rows.sort((a, b) => Math.abs(b.cents) - Math.abs(a.cents))
}

// "Good evening" depends on the viewer's clock, so it's only known after
// hydration; until then (and on the server) it's a plain "Hello".
function useGreeting() {
  const [greeting, setGreeting] = useState('Hello')
  useEffect(() => {
    const hour = new Date().getHours()
    setGreeting(hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening')
  }, [])
  return greeting
}

/** The signed-in home: where you stand, who with, and this month's spending. */
export function DashboardView({ month, today }: { month: string; today: string }) {
  const { user } = useSession()
  const greeting = useGreeting()
  const { data: friends } = useSuspenseQuery(convexQuery(api.friends.list, {}))
  const { data: groups } = useSuspenseQuery(convexQuery(api.groups.list, {}))
  const { data: personal } = useSuspenseQuery(
    convexQuery(api.personal.month, { month }),
  )
  const { data: budgets } = useSuspenseQuery(convexQuery(api.budgets.list, {}))
  const { data: spending } = useSuspenseQuery(
    convexQuery(api.budgets.monthSpending, { month }),
  )

  // Where you stand overall: friends' balances plus your net in each group.
  const balances = toBalances(friends, groups)
  const { owed, owe } = sumBalances(balances.map((b) => ({ [b.currency]: b.cents })))
  // The hero shows the currency most of your balances are in; any others are
  // listed under it.
  const currencies = [...new Set([...Object.keys(owed), ...Object.keys(owe)])] as Array<Currency>
  const weight = (c: Currency) => (owed[c] ?? 0) + (owe[c] ?? 0)
  const main: Currency =
    currencies.sort((a, b) => weight(b) - weight(a))[0] ??
    spending[0]?.currency ??
    budgets[0]?.currency ??
    groups[0]?.currency ??
    'USD'
  const firstName = user?.name.split(' ')[0]

  return (
    <>
      <PageHeader
        eyebrow={formatLongDate(today)}
        title={firstName ? `${greeting}, ${firstName}` : greeting}
        actions={
          <>
            <span className="hidden lg:block">
              <NotificationBell />
            </span>
            {/* Narrow screens have Add in the tab bar. */}
            <AddMenu trigger={<Button size="lg" className="max-lg:hidden" />}>
              <Plus strokeWidth={2.4} />
              Add expense
            </AddMenu>
          </>
        }
      />

      <div className="grid gap-4.5">
        <div className="flex flex-wrap items-stretch gap-4.5">
          <NetBalance
            main={main}
            others={currencies.filter((c) => c !== main)}
            owed={owed}
            owe={owe}
            open={balances.length}
          />
          <div className="flex flex-[1_1_220px] flex-col gap-4.5">
            <DirectionCard direction="owed" balances={balances} totals={owed} main={main} />
            <DirectionCard direction="owe" balances={balances} totals={owe} main={main} />
          </div>
          <QuickSplit groups={groups} today={today} />
        </div>

        <div className="flex flex-wrap items-stretch gap-4.5">
          <Balances balances={balances} />
          <div className="flex flex-[2_1_320px] flex-col gap-4.5">
            <ClearWhatYouOwe balances={balances} />
            <BudgetSummary month={month} budgets={budgets} spending={spending} />
          </div>
        </div>

        <div className="flex flex-wrap items-stretch gap-4.5">
          <YourGroups groups={groups} />
          <YourShare month={month} spending={spending[0]} />
        </div>

        <RecentSpending month={month} items={personal.items} />
      </div>
    </>
  )
}

/** "+₹4,820.00" with the decimals at half size. */
function HeroFigure({ cents, currency }: { cents: number; currency: Currency }) {
  const text = formatMoney(Math.abs(cents), currency)
  const dot = text.lastIndexOf('.')
  return (
    <p className="text-[2.875rem] leading-[0.95] font-semibold tracking-[-0.055em] sm:text-6xl">
      {cents > 0 ? '+' : cents < 0 ? '−' : ''}
      {dot === -1 ? text : text.slice(0, dot)}
      {dot !== -1 && (
        <span className="text-[1.5rem] text-dim sm:text-3xl">{text.slice(dot)}</span>
      )}
    </p>
  )
}

function NetBalance({
  main,
  others,
  owed,
  owe,
  open,
}: {
  main: Currency
  others: Array<Currency>
  owed: Record<string, number>
  owe: Record<string, number>
  open: number
}) {
  const owedCents = owed[main] ?? 0
  const oweCents = owe[main] ?? 0
  const total = owedCents + oweCents
  const owedShare = total ? Math.round((owedCents / total) * 100) : 0

  return (
    <section
      aria-labelledby="net-h"
      className={cn(card, 'relative flex-[2_1_380px] gap-4.5 overflow-hidden p-6')}
    >
      <span
        aria-hidden="true"
        className="absolute -top-30 -right-20 size-80 rounded-full bg-primary opacity-[0.07] blur-[60px]"
      />
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <h2 id="net-h" className="m-0 text-sm font-medium tracking-normal text-muted-foreground">
          Net balance
        </h2>
        <span className="rounded-full bg-primary/12 px-2.5 py-1.25 text-[0.8125rem] font-semibold text-primary">
          {open === 0 ? 'All settled up' : `${plural(open, 'open balance')}`}
        </span>
      </div>
      <div className="relative grid gap-2">
        <HeroFigure cents={owedCents - oweCents} currency={main} />
        {others.length > 0 && (
          <p className="font-mono text-[0.8125rem] text-muted-foreground">
            {others.map((c, i) => {
              const net = (owed[c] ?? 0) - (owe[c] ?? 0)
              return (
                <span key={c}>
                  {i > 0 && ' · '}
                  <span className={net >= 0 ? 'text-positive' : 'text-destructive'}>
                    {net > 0 ? '+' : net < 0 ? '−' : ''}
                    {formatMoney(Math.abs(net), c)}
                  </span>
                </span>
              )
            })}
          </p>
        )}
      </div>
      <div className="relative mt-auto grid gap-3">
        {/* What you're owed against what you owe, in the main currency. */}
        <div
          role="img"
          aria-label={
            total
              ? `${owedShare}% of your open balances are owed to you, ${100 - owedShare}% you owe`
              : 'No open balances'
          }
          className="flex h-2.5 gap-1 overflow-hidden rounded-full"
        >
          {total === 0 && <span className="flex-1 rounded-full bg-segment" />}
          {owedCents > 0 && (
            <span className="rounded-full bg-positive" style={{ flexGrow: owedCents }} />
          )}
          {oweCents > 0 && (
            <span className="rounded-full bg-destructive" style={{ flexGrow: oweCents }} />
          )}
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {(
            [
              ['Owed to you', owedCents, 'bg-positive', 'text-positive'],
              ['You owe', oweCents, 'bg-destructive', 'text-destructive'],
            ] as const
          ).map(([label, cents, dot, text]) => (
            <div key={label} className="grid gap-1 rounded-[14px] bg-field px-3 py-2.5">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span aria-hidden="true" className={cn('size-[7px] rounded-full', dot)} />
                {label}
              </span>
              <span className={cn('font-mono text-[1.0625rem] font-medium tabular-nums', text)}>
                {formatMoney(cents, main)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function DirectionCard({
  direction,
  balances,
  totals,
  main,
}: {
  direction: 'owed' | 'owe'
  balances: Array<Balance>
  totals: Record<string, number>
  main: Currency
}) {
  const owedToYou = direction === 'owed'
  const rows = balances.filter((b) => (owedToYou ? b.cents > 0 : b.cents < 0))
  const people = [...new Map(rows.map((b) => [b.href, b])).values()]
  const amounts = Object.entries(totals).filter(([, cents]) => cents)
  const tone = owedToYou ? 'text-positive' : 'text-destructive'

  return (
    <section aria-label={owedToYou ? 'Owed to you' : 'You owe'} className={cn(card, 'flex-1 gap-2.5 p-5')}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-medium text-muted-foreground">
          <span
            className={cn(
              'grid size-7 place-items-center rounded-lg [&_svg]:size-[15px]',
              owedToYou ? 'bg-positive/14 text-positive' : 'bg-destructive/14 text-destructive',
            )}
          >
            {owedToYou ? <ArrowDownLeft strokeWidth={2.2} /> : <ArrowUpRight strokeWidth={2.2} />}
          </span>
          {owedToYou ? 'Owed to you' : 'You owe'}
        </span>
        <span className="text-xs text-muted-foreground">
          {people.length === 0 ? 'Nobody' : plural(people.length, 'balance')}
        </span>
      </div>
      <div className="grid gap-0.5">
        {amounts.length === 0 ? (
          <p className="font-mono text-3xl font-medium tracking-[-0.03em] text-muted-foreground tabular-nums">
            {formatMoney(0, main)}
          </p>
        ) : (
          amounts.map(([currency, cents], i) => (
            <p
              key={currency}
              className={cn(
                'font-mono font-medium tracking-[-0.03em] tabular-nums',
                tone,
                i === 0 ? 'text-3xl' : 'text-base',
              )}
            >
              {formatMoney(cents, currency as Currency)}
            </p>
          ))
        )}
      </div>
      <div className="mt-auto flex min-h-10 items-center justify-between gap-2">
        <div className="flex">
          {people.slice(0, 4).map((b, i) => (
            <PersonAvatar
              key={b.key}
              name={b.name}
              size="sm"
              className={cn('ring-2 ring-card', i > 0 && '-ml-2')}
            />
          ))}
          {people.length > 4 && (
            <span className="-ml-2 grid size-7 place-items-center rounded-full bg-segment text-[0.625rem] font-semibold ring-2 ring-card">
              +{people.length - 4}
            </span>
          )}
        </div>
        {people.length > 0 && (
          <Link
            href={people.length === 1 ? people[0].href : '/friends'}
            className={cn(
              buttonVariants({ variant: owedToYou ? 'outline' : 'contrast' }),
              'no-underline',
            )}
          >
            {owedToYou ? 'See who' : 'Settle up'}
          </Link>
        )}
      </div>
    </section>
  )
}

/** Adds an equally split expense to one of your groups, without leaving home. */
function QuickSplit({ groups, today }: { groups: Array<GroupSummary>; today: string }) {
  const [groupId, setGroupId] = useState<string>(groups[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  // Until you pick, the payer is you and everyone shares it.
  const [paidBy, setPaidBy] = useState<string | null>(null)
  const [excluded, setExcluded] = useState<ReadonlyArray<string>>([])
  const selected = groups.find((g) => g.id === groupId) ?? groups[0]
  const { data: group } = useQuery(
    convexQuery(api.groups.get, selected ? { groupId: selected.id } : 'skip'),
  )
  const addExpense = useConvexMutation(api.groups.addExpense)
  const { run, pending, error, setError } = useAction(addExpense, {
    success: 'Expense added',
  })

  if (!selected) {
    return (
      <section aria-labelledby="quick-h" className={cn(card, 'flex-[1_1_280px] gap-3.5 p-5')}>
        <h2 id="quick-h" className={cardTitle}>
          Quick split
        </h2>
        <p className="text-[0.8125rem] leading-[1.45] text-muted-foreground">
          Start a group for a trip, a flat or a regular dinner, then split expenses in it
          from here.
        </p>
        <Link
          href="/groups/new"
          className={cn(buttonVariants({ size: 'lg' }), 'mt-auto no-underline')}
        >
          <Plus strokeWidth={2.4} />
          New group
        </Link>
      </section>
    )
  }

  const members = group?.members ?? []
  const payer = paidBy ?? group?.meMemberId ?? ''
  const splitAmong = members.map((m) => m.id).filter((id) => !excluded.includes(id))
  const cents = parseAmountToCents(amount)
  const share = cents && splitAmong.length ? Math.floor(cents / splitAmong.length) : 0

  function pickGroup(id: string) {
    setGroupId(id)
    setPaidBy(null)
    setExcluded([])
    setError(null)
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!group) return
    if (cents === null) {
      setError('Enter an amount like 12.50')
      return
    }
    const parsed = addExpenseInput.safeParse({
      description,
      amountCents: cents,
      paidBy: payer,
      splitAmong,
      category: 'other',
      date: today,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form')
      return
    }
    if (await run({ groupId: group.id, ...parsed.data })) {
      setAmount('')
      setDescription('')
    }
  }

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      aria-labelledby="quick-h"
      className={cn(card, 'flex-[1_1_280px] gap-3.5 p-5')}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="quick-h" className={cardTitle}>
          Quick split
        </h2>
        <span className="text-xs text-muted-foreground">{selected.currency}</span>
      </div>
      <label className="grid gap-1.5 rounded-[14px] border bg-field px-3.5 py-3 focus-within:border-primary">
        <span className={fieldLabel}>Amount</span>
        <input
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full min-w-0 border-0 bg-transparent font-mono text-[1.75rem] leading-tight font-medium tracking-[-0.03em] tabular-nums outline-none placeholder:text-dim"
        />
      </label>
      <label className="grid gap-1.5">
        <span className={fieldLabel}>What was it for?</span>
        <Input
          value={description}
          maxLength={80}
          placeholder="Groceries"
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="grid min-w-0 gap-1.5">
          <span className={fieldLabel}>Group</span>
          <SelectField
            aria-label="Group"
            value={selected.id}
            onChange={pickGroup}
            options={groups.map((g) => ({ value: g.id, label: g.name }))}
          />
        </div>
        <div className="grid min-w-0 gap-1.5">
          <span className={fieldLabel}>Paid by</span>
          {group ? (
            <SelectField
              aria-label="Paid by"
              value={payer}
              onChange={setPaidBy}
              options={group.members.map((m) => ({
                value: m.id,
                label: m.id === group.meMemberId ? 'You' : m.name,
              }))}
            />
          ) : (
            <Skeleton className="h-11 rounded-xl" />
          )}
        </div>
      </div>
      <div className="grid gap-2">
        <span className={fieldLabel}>Split equally between</span>
        <div className="flex flex-wrap gap-1.5">
          {!group && <Skeleton className="h-9 w-40 rounded-full" />}
          {members.map((m) => {
            const included = !excluded.includes(m.id)
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={included}
                onClick={() =>
                  setExcluded((list) =>
                    included ? [...list, m.id] : list.filter((id) => id !== m.id),
                  )
                }
                className={cn(
                  'flex min-h-9 items-center gap-1.5 rounded-full border py-0 pr-3 pl-1 text-[0.8125rem] font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                  included
                    ? 'border-primary bg-primary/10'
                    : 'border-input text-muted-foreground',
                )}
              >
                <PersonAvatar
                  name={m.name}
                  me={m.id === group?.meMemberId}
                  size="sm"
                  className={cn('size-6.5', !included && 'opacity-50')}
                />
                {m.id === group?.meMemberId ? 'You' : m.name.split(' ')[0]}
              </button>
            )
          })}
        </div>
      </div>
      {error && <p className="text-[0.8125rem] text-destructive">{error}</p>}
      <div className="mt-auto flex items-center justify-between gap-2.5 pt-1">
        <span className="grid gap-0.5">
          <span className={fieldLabel}>Each pays</span>
          <span className="font-mono text-base font-medium tabular-nums">
            {formatMoney(share, selected.currency)}
          </span>
        </span>
        <Button type="submit" size="lg" className="min-w-0 shrink" disabled={pending || !group}>
          {pending && <Spinner />}
          <span className="truncate">Add to {selected.name}</span>
        </Button>
      </div>
    </form>
  )
}

type Filter = 'all' | 'owed' | 'owe'

function Balances({ balances }: { balances: Array<Balance> }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [showAll, setShowAll] = useState(false)
  const matching = balances.filter(
    (b) => filter === 'all' || (filter === 'owed' ? b.cents > 0 : b.cents < 0),
  )
  const shown = showAll ? matching : matching.slice(0, MAX_BALANCES)

  return (
    <section aria-labelledby="bal-h" className={cn(card, 'flex-[3_1_480px] gap-2.5 p-5.5')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="bal-h" className={cardTitle}>
          Balances
        </h2>
        <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
          <TabsList aria-label="Filter balances">
            <TabsTrigger value="all">All · {balances.length}</TabsTrigger>
            <TabsTrigger value="owed">Owed to you</TabsTrigger>
            <TabsTrigger value="owe">You owe</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {shown.length === 0 ? (
        <p className="border-t border-divider py-8 text-center text-muted-foreground">
          {balances.length === 0
            ? 'You’re all settled up. Balances with friends and groups show up here.'
            : filter === 'owed'
              ? 'Nobody owes you right now.'
              : 'You don’t owe anyone right now.'}
        </p>
      ) : (
        <ul className="grid">
          {shown.map((b) => (
            <li
              key={b.key}
              className="flex items-center gap-3.5 border-t border-divider py-3 last:pb-0"
            >
              {b.color ? (
                <span
                  aria-hidden="true"
                  className="grid size-10 shrink-0 place-items-center rounded-xl text-on-fill"
                  style={{ background: b.color }}
                >
                  <Users className="size-5" />
                </span>
              ) : (
                <PersonAvatar name={b.name} size="lg" />
              )}
              <div className="grid min-w-0 flex-1 gap-0.5">
                <Link
                  href={b.href}
                  className="truncate text-[0.9375rem] font-semibold no-underline hover:text-primary"
                >
                  {b.name}
                </Link>
                <span className="truncate text-[0.8125rem] text-muted-foreground">{b.sub}</span>
              </div>
              <div className="grid justify-items-end gap-0.5">
                <span className="text-xs text-muted-foreground">
                  {b.cents > 0 ? (b.color ? 'you’re owed' : 'owes you') : 'you owe'}
                </span>
                <span
                  className={cn(
                    'font-mono text-[0.9375rem] font-medium tabular-nums',
                    b.cents > 0 ? 'text-positive' : 'text-destructive',
                  )}
                >
                  {formatMoney(Math.abs(b.cents), b.currency)}
                </span>
              </div>
              <Link
                href={b.href}
                className={cn(
                  buttonVariants({ variant: b.cents > 0 ? 'outline' : 'contrast' }),
                  'hidden min-w-21 no-underline sm:inline-flex',
                )}
              >
                {b.cents > 0 ? 'View' : 'Settle'}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {matching.length > MAX_BALANCES && (
        <Button
          variant="ghost"
          className="self-start text-muted-foreground"
          onClick={() => setShowAll((value) => !value)}
        >
          {showAll ? 'Show fewer' : `Show all ${matching.length}`}
        </Button>
      )}
    </section>
  )
}

function ClearWhatYouOwe({ balances }: { balances: Array<Balance> }) {
  const owing = balances.filter((b) => b.cents < 0)
  return (
    <section
      aria-labelledby="settle-h"
      className="flex flex-col gap-3.5 rounded-3xl border border-highlight-border bg-highlight p-5"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-primary text-primary-foreground">
          <Zap className="size-4.5" strokeWidth={2.2} />
        </span>
        <div className="grid gap-0.5">
          <h2 id="settle-h" className={cardTitle}>
            {owing.length === 0 ? 'Nothing to clear' : 'Clear what you owe'}
          </h2>
          <p className="text-[0.8125rem] leading-[1.45] text-soft">
            {owing.length === 0
              ? 'You don’t owe anyone. When you do, it shows up here.'
              : `${plural(owing.length, 'payment')} ${owing.length === 1 ? 'settles' : 'settle'} everything you owe. Record each one once you’ve paid.`}
          </p>
        </div>
      </div>
      {owing.slice(0, PREVIEW).map((b) => (
        <div
          key={b.key}
          className="flex items-center gap-3 rounded-[14px] bg-background/55 px-3 py-2.5"
        >
          <PersonAvatar name={b.name} />
          <span className="grid min-w-0 flex-1">
            <span className="truncate font-semibold">{b.name}</span>
            <span className="truncate text-xs text-muted-foreground">{b.sub}</span>
          </span>
          <Link href={b.href} className={cn(buttonVariants(), 'font-mono no-underline')}>
            {formatMoney(Math.abs(b.cents), b.currency)}
          </Link>
        </div>
      ))}
      {owing.length > PREVIEW && (
        <Link href="/friends" className="text-[0.8125rem] font-medium text-soft">
          And {owing.length - PREVIEW} more
        </Link>
      )}
    </section>
  )
}

function BudgetSummary({
  month,
  budgets,
  spending,
}: {
  month: string
  budgets: Array<{ currency: Currency; amountCents: number }>
  spending: Array<Spending>
}) {
  // The budget in the currency you spent most in, else your first one.
  const budget =
    budgets.find((b) => b.currency === spending[0]?.currency) ?? budgets[0]
  const spent = budget
    ? (spending.find((s) => s.currency === budget.currency)?.total ?? 0)
    : 0
  const status = budget ? budgetStatus(spent, budget.amountCents) : null
  const left = budget ? budget.amountCents - spent : 0

  return (
    <section aria-labelledby="budget-h" className={cn(card, 'flex-1 gap-3 p-5')}>
      <div className="flex min-h-9 items-center justify-between gap-2">
        <h2 id="budget-h" className={cardTitle}>
          Budget for {formatMonth(month).split(' ')[0]}
        </h2>
        <Link href="/budget" className={cardLink}>
          {budget ? 'Manage' : 'Set a budget'}
        </Link>
      </div>
      {budget && status ? (
        <>
          <p className="text-muted-foreground">
            <span className="font-mono text-[1.375rem] font-medium tracking-[-0.03em] text-foreground tabular-nums">
              {formatMoney(spent, budget.currency)}
            </span>{' '}
            of {formatMoney(budget.amountCents, budget.currency)}
          </p>
          <div className="grid gap-1.5">
            <div
              role="progressbar"
              aria-label="Budget used"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(Math.min(status.ratio, 1) * 100)}
              className="flex h-1.5 rounded-full bg-segment"
            >
              <span
                className={cn(
                  'rounded-full',
                  status.tone === 'over'
                    ? 'bg-destructive'
                    : status.tone === 'warn'
                      ? 'bg-[#F2C14E]'
                      : 'bg-primary',
                )}
                style={{ width: `${Math.min(status.ratio, 1) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{status.label}</span>
              <span className={cn(left < 0 && 'text-destructive')}>
                {left >= 0
                  ? `${formatMoney(left, budget.currency)} left`
                  : `${formatMoney(-left, budget.currency)} over`}
              </span>
            </div>
          </div>
        </>
      ) : (
        <p className="text-[0.8125rem] leading-[1.45] text-muted-foreground">
          Set a monthly limit for everything you spend, including your share with friends
          and in groups, and see how the month is going.
        </p>
      )}
    </section>
  )
}

function YourGroups({ groups }: { groups: Array<GroupSummary> }) {
  return (
    <section aria-labelledby="groups-h" className={cn(card, 'flex-[3_1_480px] gap-3.5 p-5.5')}>
      <div className="flex min-h-9 items-center justify-between gap-2">
        <h2 id="groups-h" className={cardTitle}>
          Your groups
        </h2>
        <Link href="/groups" className={cardLink}>
          View all
        </Link>
      </div>
      {groups.length === 0 ? (
        <p className="py-6 text-center text-muted-foreground">
          No groups yet.{' '}
          <Link href="/groups/new" className="text-foreground">
            Start one
          </Link>{' '}
          for a trip or a flat.
        </p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(190px,100%),1fr))] gap-3">
          {groups.slice(0, 6).map((group) => (
            <GroupTile key={group.id} group={group} />
          ))}
        </div>
      )}
    </section>
  )
}

const SOURCES = [
  { key: 'personal', label: 'Personal', color: 'var(--accent)' },
  { key: 'friends', label: 'With friends', color: 'var(--owed)' },
  { key: 'groups', label: 'In groups', color: 'var(--owe)' },
] as const

/** A donut of this month's spending by where it happened. */
function YourShare({ month, spending }: { month: string; spending: Spending | undefined }) {
  const parts = SOURCES.map((source) => ({ ...source, cents: spending?.[source.key] ?? 0 }))
  const total = spending?.total ?? 0
  const visible = parts.filter((part) => part.cents > 0)
  // The circle's circumference is 100, so a segment's length is its percent;
  // a small gap separates neighbours.
  const gap = visible.length > 1 ? 1.3 : 0
  let offset = 0

  return (
    <section aria-labelledby="spend-h" className={cn(card, 'flex-[2_1_320px] gap-4 p-5.5')}>
      <div className="flex min-h-9 items-center justify-between gap-2">
        <h2 id="spend-h" className={cardTitle}>
          Your share in {formatMonth(month).split(' ')[0]}
        </h2>
        <Link href="/budget" className={cardLink}>
          Details
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-5.5">
        <div className="relative size-37.5 shrink-0">
          <svg
            role="img"
            aria-label={
              total
                ? `Spending split: ${visible
                    .map((part) => `${part.label} ${Math.round((part.cents / total) * 100)}%`)
                    .join(', ')}`
                : 'No spending yet this month'
            }
            viewBox="0 0 42 42"
            className="size-full -rotate-90"
          >
            <circle cx="21" cy="21" r="15.915" fill="none" strokeWidth="5" className="stroke-divider" />
            {visible.map((part) => {
              const length = (part.cents / total) * 100
              const segment = (
                <circle
                  key={part.key}
                  cx="21"
                  cy="21"
                  r="15.915"
                  fill="none"
                  strokeWidth="5"
                  stroke={part.color}
                  strokeDasharray={`${Math.max(length - gap, 0.5)} ${100 - Math.max(length - gap, 0.5)}`}
                  strokeDashoffset={-offset}
                />
              )
              offset += length
              return segment
            })}
          </svg>
          <div className="absolute inset-0 grid place-content-center justify-items-center gap-0.5">
            <span className="font-mono text-base font-medium tabular-nums">
              {spending ? formatMoney(total, spending.currency) : '—'}
            </span>
            <span className="text-[0.6875rem] text-muted-foreground">after splits</span>
          </div>
        </div>
        <ul className="grid flex-[1_1_140px] gap-3">
          {parts.map((part) => (
            <li key={part.key} className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="size-2.5 rounded-[3px]"
                style={{ background: part.color }}
              />
              <span className="flex-1">{part.label}</span>
              <span className="font-mono text-[0.8125rem] tabular-nums">
                {spending ? formatMoney(part.cents, spending.currency) : '—'}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function RecentSpending({
  month,
  items,
}: {
  month: string
  items: PersonalMonth['items']
}) {
  return (
    <section aria-labelledby="act-h" className={cn(card, 'gap-3 p-5.5')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="act-h" className={cardTitle}>
          Recent personal spending
        </h2>
        <Link
          href="/personal"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'font-normal no-underline')}
        >
          View all
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="border-t border-divider py-8 text-center text-muted-foreground">
          No personal expenses in {formatMonth(month)} yet.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Expense</TableHead>
              <TableHead className="hidden md:table-cell">Category</TableHead>
              <TableHead className="hidden md:table-cell">Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.slice(0, PREVIEW).map((expense) => (
              <TableRow key={expense.id}>
                <TableCell>
                  <span className="flex items-center gap-3">
                    <CategoryIcon category={expense.category} />
                    <span className="grid min-w-0">
                      <span className="truncate font-semibold">{expense.description}</span>
                      <span className="truncate text-xs text-muted-foreground md:hidden">
                        {categoryLabel(expense.category)} · {formatDate(expense.date)}
                      </span>
                    </span>
                  </span>
                </TableCell>
                <TableCell className="hidden text-soft md:table-cell">
                  {categoryLabel(expense.category)}
                </TableCell>
                <TableCell className="hidden text-soft md:table-cell">
                  {formatDate(expense.date)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatMoney(expense.amountCents, expense.currency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
