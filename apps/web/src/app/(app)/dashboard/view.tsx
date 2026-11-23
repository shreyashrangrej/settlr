'use client'

import { useEffect, useState } from 'react'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import Link from 'next/link'
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  CircleCheck,
  Plus,
  Scale,
  Users,
  UsersRound,
  Wallet,
} from 'lucide-react'

import { AddMenu } from '#/components/add-menu'
import { budgetStatus, type Spending } from '#/components/budget'
import { CategoryIcon, groupColor, labelTint } from '#/components/category'
import {
  ExpenseRow,
  ExpenseTable,
  YourShare,
} from '#/components/expense-list'
import { SelectField } from '#/components/form-fields'
import { PersonAvatar, SignedAmount, sumBalances, useAction } from '#/components/ledger'
import { PageHeader } from '#/components/page-header'
import { useSession } from '#/components/providers'
import { StatCard, StatGrid } from '#/components/stat-card'
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
  formatLongDate,
  formatMoney,
  formatMonth,
  formatWholeMoney,
  parseAmountToCents,
  plural,
} from '@settlr/shared/format'
import { addExpenseInput, type Currency } from '@settlr/shared/schemas'
import type { Friend, GroupSummary } from '#/lib/types'
import { RECENT_ARGS } from '#/lib/dashboard'
import { cn } from '#/lib/utils'
import { api } from '@settlr/backend/convex/_generated/api'

const PREVIEW = 5
const MAX_BALANCES = 8

const card = 'flex min-w-0 flex-col rounded-xl border bg-card'
// A card whose rows run edge to edge (Gr8r's panel): no padding of its own.
const panel = cn(card, 'overflow-hidden')
const cardTitle = 'm-0 text-sm font-semibold'
const cardLink =
  'text-xs font-medium text-muted-foreground no-underline hover:text-foreground'
const fieldLabel = 'text-xs text-muted-foreground'

// One line in the balances list: a friend (per currency) or a group you
// aren't square in. Positive `cents` is owed to you.
type Balance = {
  key: string
  name: string
  sub: string
  href: string
  // Where to record paying it off: the friend's payment form, or the
  // group's settle-up plan.
  settleHref: string
  cents: number
  currency: Currency
  // Groups have a colour; friends get a person avatar.
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
        settleHref: `/friends/${friend.id}?tab=payment`,
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
      settleHref: `/groups/${group.id}#settle-up`,
      cents: group.myNetCents,
      currency: group.currency,
      color: groupColor(group.id),
    })
  }
  return rows.sort((a, b) => Math.abs(b.cents) - Math.abs(a.cents))
}

type Filter = 'all' | 'owed' | 'owe'

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
  const { data: budgets } = useSuspenseQuery(convexQuery(api.budgets.list, {}))
  const { data: spending } = useSuspenseQuery(
    convexQuery(api.budgets.monthSpending, { month }),
  )
  // The balances list's filter; the totals in Net balance set it too.
  const [filter, setFilter] = useState<Filter>('all')

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

  function showBalances(next: Filter) {
    setFilter(next)
    document.getElementById('balances')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      <PageHeader
        title={firstName ? `${greeting}, ${firstName}` : greeting}
        description={`${formatLongDate(today)} · Here’s where you stand.`}
        actions={
          <>
            <Link
              href="/groups/new"
              className={cn(buttonVariants({ variant: 'outline' }), 'no-underline max-sm:hidden')}
            >
              <UsersRound />
              New group
            </Link>
            <AddMenu trigger={<Button />}>
              <Plus />
              Add expense
            </AddMenu>
          </>
        }
      />

      <DashboardStats
        className="mb-4"
        main={main}
        balances={balances}
        owed={owed}
        owe={owe}
        month={month}
        spending={spending}
        budgets={budgets}
        onShow={showBalances}
      />

      {/*
        Gr8r's home grid: a wide column of lists beside a narrower one of
        tools, from `xl`. Below that it's one column, where the column
        wrappers drop out (`contents`) and `order` puts the panels in
        reading order (balances, then this month's share and budget).
      */}
      <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] xl:items-start">
        <div className="contents xl:flex xl:flex-col xl:gap-4">
          <Balances
            className="max-xl:order-1"
            balances={balances}
            filter={filter}
            onFilter={setFilter}
          />
          <RecentExpenses className="max-xl:order-6" month={month} />
          <GroupsTable className="max-xl:order-7" groups={groups} />
        </div>
        <div className="contents xl:flex xl:flex-col xl:gap-4">
          {/* This month's share and budget lead the column, then what to
              settle and the quick split. */}
          <ShareDonut className="max-xl:order-2" month={month} spending={spending[0]} />
          <BudgetSummary
            className="max-xl:order-3"
            month={month}
            budgets={budgets}
            spending={spending}
          />
          <ToSettle className="max-xl:order-4" balances={balances} />
          <QuickSplit className="max-xl:order-5" groups={groups} today={today} />
        </div>
      </div>
    </>
  )
}

/** A friend's avatar, or a group's colour tile. */
function BalanceAvatar({
  balance,
  size = 'default',
  className,
}: {
  balance: Pick<Balance, 'name' | 'color'>
  size?: 'sm' | 'default' | 'lg'
  className?: string
}) {
  if (!balance.color) {
    return <PersonAvatar name={balance.name} size={size} className={className} />
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid shrink-0 place-items-center',
        size === 'sm' && 'size-5.5 rounded-md [&_svg]:size-3',
        size === 'default' && 'size-7 rounded-md [&_svg]:size-3.5',
        size === 'lg' && 'size-9 rounded-lg [&_svg]:size-4.5',
        className,
      )}
      style={labelTint(balance.color)}
    >
      <Users />
    </span>
  )
}

/**
 * Gr8r's panel header: the title on the left, then its controls (a
 * segmented filter, a link) on the right.
 */
function PanelHeader({
  id,
  title,
  children,
}: {
  id: string
  title: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="flex min-h-12 flex-wrap items-center gap-2 px-3.5 pt-3 pb-2.5">
      <h2 id={id} className={cardTitle}>
        {title}
      </h2>
      {children && <div className="ml-auto flex items-center gap-1">{children}</div>}
    </div>
  )
}

/**
 * The strip across the top (Gr8r's stats): where you stand overall, each
 * direction (a click filters the balances list) and what this month cost
 * you against your budget.
 */
function DashboardStats({
  main,
  balances,
  owed,
  owe,
  month,
  spending,
  budgets,
  onShow,
  className,
}: {
  main: Currency
  balances: Array<Balance>
  owed: Record<string, number>
  owe: Record<string, number>
  month: string
  spending: Array<Spending>
  budgets: Array<{ currency: Currency; amountCents: number }>
  onShow: (filter: Filter) => void
  className?: string
}) {
  const owedCents = owed[main] ?? 0
  const oweCents = owe[main] ?? 0
  const net = owedCents - oweCents
  // People and groups, not currencies: a friend in two currencies is one.
  const count = (owedToYou: boolean) =>
    new Set(balances.filter((b) => (owedToYou ? b.cents > 0 : b.cents < 0)).map((b) => b.href)).size
  const owedCount = count(true)
  const oweCount = count(false)
  const spent = spending[0]
  const budget = spent && budgets.find((b) => b.currency === spent.currency)

  return (
    <StatGrid className={className}>
      <StatCard
        label="Net balance"
        icon={<Scale />}
        tone={net > 0 ? 'positive' : net < 0 ? 'negative' : undefined}
        value={`${net > 0 ? '+' : net < 0 ? '−' : ''}${formatMoney(Math.abs(net), main)}`}
        hint={balances.length === 0 ? 'All settled up' : plural(balances.length, 'open balance')}
      />
      <StatCard
        label="Owed to you"
        icon={<ArrowDownLeft />}
        tone="positive"
        value={owedCents ? formatMoney(owedCents, main) : ''}
        hint={owedCount ? `From ${plural(owedCount, 'person or group', 'people and groups')}` : 'Nobody owes you'}
        onClick={owedCount ? () => onShow('owed') : undefined}
        title={owedCount ? 'Show who owes you' : undefined}
      />
      <StatCard
        label="You owe"
        icon={<ArrowUpRight />}
        tone="negative"
        value={oweCents ? formatMoney(oweCents, main) : ''}
        hint={oweCount ? `To ${plural(oweCount, 'person or group', 'people and groups')}` : 'You don’t owe anyone'}
        onClick={oweCount ? () => onShow('owe') : undefined}
        title={oweCount ? 'Show who you owe' : undefined}
      />
      <StatCard
        label={`Your share in ${formatMonth(month).split(' ')[0]}`}
        icon={<Wallet />}
        value={spent ? formatMoney(spent.total, spent.currency) : ''}
        hint={
          budget
            ? `${budgetStatus(spent.total, budget.amountCents).label} · ${formatMoney(budget.amountCents, budget.currency)} budget`
            : 'Personal, friends and groups'
        }
      />
    </StatGrid>
  )
}

/** Adds an equally split expense to one of your groups, without leaving home. */
function QuickSplit({
  groups,
  today,
  className,
}: {
  groups: Array<GroupSummary>
  today: string
  className?: string
}) {
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
      <section aria-labelledby="quick-h" className={cn(card, 'gap-3.5 p-3.5', className)}>
        <h2 id="quick-h" className={cardTitle}>
          Quick split
        </h2>
        <p className="text-xs leading-normal text-muted-foreground">
          Start a group for a trip, a flat or a regular dinner, then split expenses in it
          from here.
        </p>
        <Link
          href="/groups/new"
          className={cn(buttonVariants(), 'mt-auto no-underline')}
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
      className={cn(card, 'gap-3.5 p-3.5', className)}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="quick-h" className={cardTitle}>
          Quick split
        </h2>
        <span className="text-xs text-muted-foreground">{selected.currency}</span>
      </div>
      <label className="grid gap-1.5 rounded-lg border bg-field px-3.5 py-3 focus-within:border-primary">
        <span className={fieldLabel}>Amount</span>
        <input
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full min-w-0 border-0 bg-transparent text-[1.75rem] leading-tight font-semibold tracking-[-0.02em] tabular-nums outline-none placeholder:text-dim"
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
            <Skeleton className="h-9 rounded-lg sm:h-7.5" />
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
                  'flex h-8 items-center gap-1.5 rounded-lg border py-0 pr-2.5 pl-1 text-xs font-medium transition-colors duration-140 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:h-7',
                  included
                    ? 'border-highlight-border bg-primary-soft text-foreground'
                    : 'bg-card text-muted-foreground hover:bg-muted',
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
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="mt-auto flex items-center justify-between gap-2.5 pt-1">
        <span className="grid gap-0.5">
          <span className={fieldLabel}>Each pays</span>
          <span className="text-base font-medium tabular-nums">
            {formatMoney(share, selected.currency)}
          </span>
        </span>
        <Button type="submit" className="min-w-0 shrink" disabled={pending || !group}>
          {pending && <Spinner />}
          <span className="truncate">Add to {selected.name}</span>
        </Button>
      </div>
    </form>
  )
}

/**
 * Everyone you have an open balance with, filtered by direction. A row
 * opens the friend or group; rows you owe also get a Settle button.
 */
function Balances({
  balances,
  filter,
  onFilter,
  className,
}: {
  balances: Array<Balance>
  filter: Filter
  onFilter: (filter: Filter) => void
  className?: string
}) {
  const [showAll, setShowAll] = useState(false)
  const matching = balances.filter(
    (b) => filter === 'all' || (filter === 'owed' ? b.cents > 0 : b.cents < 0),
  )
  const shown = showAll ? matching : matching.slice(0, MAX_BALANCES)
  const owedCount = balances.filter((b) => b.cents > 0).length

  return (
    <section
      id="balances"
      aria-labelledby="bal-h"
      className={cn(panel, 'scroll-mt-15 lg:scroll-mt-4', className)}
    >
      <PanelHeader id="bal-h" title="Balances">
        <Tabs value={filter} onValueChange={(value) => onFilter(value as Filter)}>
          <TabsList aria-label="Filter balances">
            <TabsTrigger value="all">
              All <span className="text-faint tabular-nums">{balances.length}</span>
            </TabsTrigger>
            <TabsTrigger value="owed">
              Owed to you <span className="text-faint tabular-nums">{owedCount}</span>
            </TabsTrigger>
            <TabsTrigger value="owe">
              You owe{' '}
              <span className="text-faint tabular-nums">{balances.length - owedCount}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </PanelHeader>
      {shown.length === 0 ? (
        <p className="border-t border-divider px-3.5 py-8 text-center text-sm text-muted-foreground">
          {balances.length === 0
            ? 'You’re all settled up. Balances with friends and groups show up here.'
            : filter === 'owed'
              ? 'Nobody owes you right now.'
              : 'You don’t owe anyone right now.'}
        </p>
      ) : (
        <ul className="grid border-t border-divider">
          {shown.map((b) => (
            <li
              key={b.key}
              // The name's link covers the whole row (its ::after); the
              // Settle button sits above it.
              className="group/row relative flex min-h-13 items-center gap-2.5 border-b border-divider px-3.5 py-2 transition-colors duration-140 last:border-b-0 hover:bg-muted"
            >
              <BalanceAvatar balance={b} />
              <div className="grid min-w-0 flex-1">
                <Link
                  href={b.href}
                  className="truncate text-sm font-medium no-underline outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
                >
                  {b.name}
                </Link>
                <span className="truncate text-xs text-faint">{b.sub}</span>
              </div>
              <div className="grid justify-items-end">
                <span
                  className={cn(
                    'text-sm font-medium tabular-nums',
                    b.cents > 0 ? 'text-positive' : 'text-destructive',
                  )}
                >
                  {b.cents > 0 ? '+' : '−'}
                  {formatMoney(Math.abs(b.cents), b.currency)}
                </span>
                <span className="text-xs text-faint">
                  {b.cents > 0 ? 'owed to you' : 'you owe'}
                </span>
              </div>
              <span className="hidden w-17 justify-end sm:flex">
                {b.cents < 0 ? (
                  <Link
                    href={b.settleHref}
                    className={cn(
                      buttonVariants({ variant: 'contrast', size: 'sm' }),
                      'relative z-10 no-underline',
                    )}
                  >
                    Settle
                  </Link>
                ) : (
                  <ChevronRight
                    aria-hidden="true"
                    className="size-4 text-dim transition-transform group-hover/row:translate-x-0.5 group-hover/row:text-foreground"
                  />
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {matching.length > MAX_BALANCES && (
        <button
          type="button"
          onClick={() => setShowAll((value) => !value)}
          className="flex h-9 items-center gap-1.5 border-t border-divider px-3.5 text-left text-ui text-muted-foreground transition-colors duration-140 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          {showAll ? 'Show fewer' : `View all ${matching.length}`}
          <ArrowRight className="size-3.5" />
        </button>
      )}
    </section>
  )
}

/**
 * What you owe, one payment per person or group, each with a button to
 * settle it (Gr8r's "upcoming deadlines" panel). On narrow screens it's
 * left out when there's nothing to settle.
 */
function ToSettle({
  balances,
  className,
}: {
  balances: Array<Balance>
  className?: string
}) {
  const owing = balances.filter((b) => b.cents < 0)
  return (
    <section
      aria-labelledby="settle-h"
      className={cn(panel, owing.length === 0 && 'max-xl:hidden', className)}
    >
      <PanelHeader
        id="settle-h"
        title={
          <>
            To settle{' '}
            {owing.length > 0 && (
              <span className="font-normal text-faint tabular-nums">{owing.length}</span>
            )}
          </>
        }
      />
      {owing.length === 0 ? (
        <div className="grid justify-items-center gap-1 border-t border-divider px-3.5 py-7 text-center">
          <CircleCheck className="size-5.5 text-dim" aria-hidden="true" />
          <p className="text-sm font-semibold">Nothing to settle</p>
          <p className="max-w-60 text-ui text-muted-foreground">
            You don’t owe anyone. When you do, it shows up here.
          </p>
        </div>
      ) : (
        <ul className="grid border-t border-divider pb-1">
          {owing.slice(0, PREVIEW).map((b) => (
            <li key={b.key} className="flex items-center gap-2.5 px-3.5 py-2">
              <BalanceAvatar balance={b} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm">{b.name}</span>
              <span className="text-sm font-medium text-destructive tabular-nums">
                {formatMoney(Math.abs(b.cents), b.currency)}
              </span>
              <Link
                href={b.settleHref}
                aria-label={`Settle ${formatMoney(Math.abs(b.cents), b.currency)} with ${b.name}`}
                className={cn(buttonVariants({ variant: 'contrast', size: 'sm' }), 'no-underline')}
              >
                Settle
              </Link>
            </li>
          ))}
          {owing.length > PREVIEW && (
            <li className="px-3.5 pt-1 pb-1.5 pl-11 text-xs text-faint">
              +{owing.length - PREVIEW} more in Balances
            </li>
          )}
        </ul>
      )}
    </section>
  )
}

function BudgetSummary({
  month,
  budgets,
  spending,
  className,
}: {
  month: string
  budgets: Array<{ currency: Currency; amountCents: number }>
  spending: Array<Spending>
  className?: string
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
    <section aria-labelledby="budget-h" className={cn(card, 'gap-3 p-3.5', className)}>
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
            <span className="text-[1.375rem] font-medium tracking-[-0.02em] text-foreground tabular-nums">
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
              className="flex h-1.5 rounded-full bg-track"
            >
              <span
                className={cn(
                  'origin-left animate-grow-x rounded-full',
                  status.tone === 'over'
                    ? 'bg-destructive'
                    : status.tone === 'warn'
                      ? 'bg-warning'
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
        <p className="text-xs leading-normal text-muted-foreground">
          Set a monthly limit for everything you spend, including your share with friends
          and in groups, and see how the month is going.
        </p>
      )}
    </section>
  )
}

/**
 * This month's latest expenses from everywhere (the All expenses list),
 * as a flush table, with "View all" going to the full page.
 */
function RecentExpenses({ month, className }: { month: string; className?: string }) {
  const { data } = useSuspenseQuery(
    convexQuery(api.expenses.month, { month, ...RECENT_ARGS }),
  )
  return (
    <section aria-labelledby="recent-h" className={cn(panel, className)}>
      <PanelHeader id="recent-h" title="Recent expenses">
        <Link href="/expenses" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'no-underline')}>
          View all
        </Link>
      </PanelHeader>
      {data.items.length === 0 ? (
        <p className="border-t border-divider px-3.5 py-8 text-center text-sm text-muted-foreground">
          No expenses in {formatMonth(month)} yet.
        </p>
      ) : (
        <ExpenseTable first="Expense" columns={['Where', 'Paid by']} actions={false}>
          {data.items.map((item) => (
            <ExpenseRow
              key={item.key}
              icon={<CategoryIcon category={item.category} />}
              title={item.description}
              href={
                item.source === 'group'
                  ? `/groups/${item.where?.id}`
                  : item.source === 'friend'
                    ? `/friends/${item.where?.id}`
                    : '/personal'
              }
              subtitle={categoryLabel(item.category)}
              date={item.date}
              cells={[
                item.source === 'personal' ? 'Personal' : (item.where?.name ?? ''),
                { value: item.paidBy, folded: `${item.paidBy} paid` },
              ]}
              amount={
                <>
                  <span>{formatMoney(item.amountCents, item.currency)}</span>
                  {item.shareCents !== item.amountCents && (
                    <YourShare cents={formatMoney(item.shareCents, item.currency)} />
                  )}
                </>
              }
            />
          ))}
        </ExpenseTable>
      )}
    </section>
  )
}


/** Your groups as a table (Gr8r's project progress): spending and where you stand. */
function GroupsTable({
  groups,
  className,
}: {
  groups: Array<GroupSummary>
  className?: string
}) {
  return (
    <section aria-labelledby="groups-h" className={cn(panel, className)}>
      <PanelHeader id="groups-h" title="Your groups">
        <Link href="/groups" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'no-underline')}>
          All groups
        </Link>
      </PanelHeader>
      {groups.length === 0 ? (
        <p className="border-t border-divider px-3.5 py-8 text-center text-sm text-muted-foreground">
          No groups yet.{' '}
          <Link href="/groups/new" className="text-foreground">
            Start one
          </Link>{' '}
          for a trip or a flat.
        </p>
      ) : (
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead>Group</TableHead>
              <TableHead className="hidden w-24 md:table-cell">Members</TableHead>
              <TableHead className="hidden w-32 text-right sm:table-cell">Spent</TableHead>
              <TableHead className="w-32 text-right">Your balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.slice(0, 6).map((group) => (
              <TableRow key={group.id}>
                <TableCell className="font-medium">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className="grid size-7 shrink-0 place-items-center rounded-md [&_svg]:size-3.5"
                      style={labelTint(groupColor(group.id))}
                    >
                      <Users />
                    </span>
                    <span className="grid min-w-0">
                      <Link
                        href={`/groups/${group.id}`}
                        className="truncate text-foreground no-underline hover:text-primary"
                      >
                        {group.name}
                      </Link>
                      <span className="truncate text-xs font-normal text-faint">
                        {plural(group.expenseCount, 'expense')} · {group.currency}
                      </span>
                    </span>
                  </span>
                </TableCell>
                <TableCell className="hidden text-muted-foreground tabular-nums md:table-cell">
                  {group.memberCount}
                </TableCell>
                <TableCell className="hidden text-right text-muted-foreground tabular-nums sm:table-cell">
                  {formatWholeMoney(group.totalCents, group.currency)}
                </TableCell>
                <TableCell className="text-right">
                  {group.myNetCents === 0 ? (
                    <span className="text-faint">Square</span>
                  ) : (
                    <SignedAmount cents={group.myNetCents} currency={group.currency} />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
function ShareDonut({
  month,
  spending,
  className,
}: {
  month: string
  spending: Spending | undefined
  className?: string
}) {
  const parts = SOURCES.map((source) => ({ ...source, cents: spending?.[source.key] ?? 0 }))
  const total = spending?.total ?? 0
  const visible = parts.filter((part) => part.cents > 0)
  // The circle's circumference is 100, so a segment's length is its percent;
  // a small gap separates neighbours.
  const gap = visible.length > 1 ? 1.3 : 0
  let offset = 0

  return (
    <section aria-labelledby="spend-h" className={cn(card, 'gap-4 p-3.5', className)}>
      <div className="flex min-h-9 items-center justify-between gap-2">
        <h2 id="spend-h" className={cardTitle}>
          Your share in {formatMonth(month).split(' ')[0]}
        </h2>
        <Link href="/budget" className={cardLink}>
          Details
        </Link>
      </div>
      {total === 0 ? (
        <p className="border-t border-divider py-6 text-center text-xs leading-normal text-muted-foreground">
          Nothing spent in {formatMonth(month)} yet. Your share of personal, friend and
          group expenses shows up here.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-5.5">
          <div className="relative size-37.5 shrink-0">
            <svg
              role="img"
              aria-label={`Spending split: ${visible
                .map((part) => `${part.label} ${Math.round((part.cents / total) * 100)}%`)
                .join(', ')}`}
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
              <span className="text-base font-medium tabular-nums">
                {spending && formatMoney(total, spending.currency)}
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
                <span className="text-xs tabular-nums">
                  {spending && formatMoney(part.cents, spending.currency)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
