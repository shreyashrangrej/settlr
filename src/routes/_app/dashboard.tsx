import { convexQuery } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute, useRouteContext } from '@tanstack/react-router'
import { ArrowRight, Users, UsersRound, Wallet } from 'lucide-react'

import {
  Avatar,
  BalanceText,
  SignedAmount,
  sumBalances,
} from '#/components/ledger'
import {
  categoryLabel,
  currentMonth,
  formatBalances,
  formatDate,
  formatMoney,
  formatMonth,
} from '#/lib/format'
import { api } from '#convex/_generated/api'

const PREVIEW = 5

// SSR: full. The signed-in home: one live summary of friends, groups and
// personal spending. All three queries are prefetched in parallel.
export const Route = createFileRoute('/_app/dashboard')({
  loader: async ({ context }) => {
    const month = currentMonth()
    await Promise.all([
      context.queryClient.ensureQueryData(convexQuery(api.friends.list, {})),
      context.queryClient.ensureQueryData(convexQuery(api.groups.list, {})),
      context.queryClient.ensureQueryData(
        convexQuery(api.personal.month, { month }),
      ),
    ])
    return { month }
  },
  head: () => ({ meta: [{ title: 'Overview · Settlr' }] }),
  component: DashboardPage,
})

function DashboardPage() {
  const { user } = useRouteContext({ from: '__root__' })
  const { month } = Route.useLoaderData()
  const { data: friends } = useSuspenseQuery(convexQuery(api.friends.list, {}))
  const { data: groups } = useSuspenseQuery(convexQuery(api.groups.list, {}))
  const { data: personal } = useSuspenseQuery(
    convexQuery(api.personal.month, { month }),
  )

  // Where you stand overall: friends' balances plus your net in each group.
  const { owed, owe } = sumBalances([
    ...friends.map((f) => f.balances),
    ...groups.map((g) => ({ [g.currency]: g.myNetCents })),
  ])
  const firstName = user?.name.split(' ')[0]

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{firstName ? `Hi, ${firstName}` : 'Overview'}</h1>
          <p className="muted">Everything you share, and everything that’s yours.</p>
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="You are owed" tone="positive" value={formatBalances(owed)} />
        <Stat label="You owe" tone="negative" value={formatBalances(owe)} />
        <Stat
          label={`Personal spending, ${formatMonth(month)}`}
          value={personal.totals
            .map((t) => formatMoney(t.cents, t.currency))
            .join(' + ')}
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Section
          title="Friends"
          icon={<UsersRound className="size-4" />}
          to="/friends"
          action="All friends"
          empty={friends.length === 0 && 'Add a friend to split one-on-one.'}
        >
          <ul className="expense-list">
            {friends.slice(0, PREVIEW).map((friend) => (
              <li key={friend.id}>
                <Link
                  to="/friends/$friendId"
                  params={{ friendId: friend.id }}
                  className="expense no-underline hover:bg-muted/40"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar name={friend.name} />
                    <span className="expense__title truncate">{friend.name}</span>
                  </span>
                  <span className="text-right text-sm">
                    <BalanceText balances={friend.balances} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          title="Groups"
          icon={<Users className="size-4" />}
          to="/groups"
          action="All groups"
          empty={groups.length === 0 && 'Start a group for a trip or a flat.'}
        >
          <ul className="expense-list">
            {groups.slice(0, PREVIEW).map((group) => (
              <li key={group.id}>
                <Link
                  to="/groups/$groupId"
                  params={{ groupId: group.id }}
                  className="expense no-underline hover:bg-muted/40"
                >
                  <span className="min-w-0">
                    <span className="expense__title block truncate">{group.name}</span>
                    <span className="muted block text-sm">
                      {group.memberCount} members ·{' '}
                      {formatMoney(group.totalCents, group.currency)} total
                    </span>
                  </span>
                  {group.myNetCents === 0 ? (
                    <span className="muted text-sm">Square</span>
                  ) : (
                    <SignedAmount
                      cents={group.myNetCents}
                      currency={group.currency}
                      className="text-sm"
                    />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          title="Personal"
          icon={<Wallet className="size-4" />}
          to="/personal"
          action="All personal expenses"
          empty={
            personal.items.length === 0 &&
            `No personal expenses in ${formatMonth(month)} yet.`
          }
        >
          <ul className="expense-list">
            {personal.items.slice(0, PREVIEW).map((expense) => (
              <li key={expense.id} className="expense">
                <span className="min-w-0">
                  <span className="expense__title block truncate">
                    {expense.description}
                  </span>
                  <span className="muted block text-sm">
                    {formatDate(expense.date)} · {categoryLabel(expense.category)}
                  </span>
                </span>
                <span className="amount text-sm">
                  {formatMoney(expense.amountCents, expense.currency)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'positive' | 'negative'
}) {
  return (
    <div className="card">
      <p className="muted text-sm">{label}</p>
      <p className={`card__stat ${value ? (tone ?? '') : 'muted'}`}>
        {value || '—'}
      </p>
    </div>
  )
}

function Section({
  title,
  icon,
  to,
  action,
  empty,
  children,
}: {
  title: string
  icon: React.ReactNode
  to: '/friends' | '/groups' | '/personal'
  action: string
  empty: string | false
  children: React.ReactNode
}) {
  return (
    <section className="grid gap-3" aria-labelledby={`${title}-heading`}>
      <div className="flex items-center justify-between gap-2">
        <h2 id={`${title}-heading`} className="m-0 flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-primary/15 text-primary">
            {icon}
          </span>
          {title}
        </h2>
        <Link
          to={to}
          className="group inline-flex items-center gap-1 text-sm font-medium text-primary no-underline hover:underline"
        >
          {action}
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
      {empty ? <p className="empty">{empty}</p> : children}
    </section>
  )
}
