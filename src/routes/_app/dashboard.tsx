import { convexQuery } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute, useRouteContext } from '@tanstack/react-router'
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Plus,
  Users,
  UsersRound,
  Wallet,
} from 'lucide-react'

import { budgetStatus } from '#/components/budget'
import { PageHeader } from '#/components/page-header'
import { StatCard, StatGrid } from '#/components/stat-card'
import { BalanceText, PersonAvatar, SignedAmount, sumBalances } from '#/components/ledger'
import { buttonVariants } from '#/components/ui/button'
import {
  Card,
  CardAction,
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
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '#/components/ui/item'
import {
  categoryLabel,
  currentMonth,
  formatBalances,
  formatDate,
  formatMoney,
  formatMonth,
  plural,
} from '#/lib/format'
import { cn } from '#/lib/utils'
import { DashboardSkeleton } from '#/components/skeletons'
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
      context.queryClient.ensureQueryData(convexQuery(api.budgets.list, {})),
    ])
    return { month }
  },
  head: () => ({ meta: [{ title: 'Overview · Settlr' }] }),
  pendingComponent: DashboardSkeleton,
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
  const { data: budgets } = useSuspenseQuery(convexQuery(api.budgets.list, {}))
  // Personal spending against the budget in its main currency.
  const mainSpend = personal.totals[0]
  const budget = budgets.find(
    (b) => b.currency === (mainSpend?.currency ?? budgets[0]?.currency),
  )
  const budgetState = budget
    ? budgetStatus(mainSpend?.cents ?? 0, budget.amountCents)
    : null

  // Where you stand overall: friends' balances plus your net in each group.
  const { owed, owe } = sumBalances([
    ...friends.map((f) => f.balances),
    ...groups.map((g) => ({ [g.currency]: g.myNetCents })),
  ])
  const firstName = user?.name.split(' ')[0]

  return (
    <>
      <PageHeader
        title={firstName ? `Hi, ${firstName}` : 'Overview'}
        description="Everything you share, and everything that’s yours."
        actions={
          <>
            <Link
              to="/personal"
              className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'no-underline')}
            >
              <Wallet />
              Log spending
            </Link>
            <Link
              to="/groups/new"
              className={cn(buttonVariants({ size: 'lg' }), 'no-underline')}
            >
              <Plus />
              New group
            </Link>
          </>
        }
      />

      <StatGrid className="mb-6">
        <StatCard
          label="You are owed"
          icon={<ArrowDownLeft />}
          tone="positive"
          value={formatBalances(owed)}
        />
        <StatCard
          label="You owe"
          icon={<ArrowUpRight />}
          tone="negative"
          value={formatBalances(owe)}
        />
        <StatCard
          label={`Personal · ${formatMonth(month)}`}
          icon={<Wallet />}
          value={personal.totals
            .map((t) => formatMoney(t.cents, t.currency))
            .join(' + ')}
          tone={budgetState?.tone === 'over' ? 'negative' : undefined}
          hint={
            budget
              ? `of ${formatMoney(budget.amountCents, budget.currency)} budget · ${budgetState?.label}`
              : personal.items.length
                ? plural(personal.items.length, 'expense')
                : undefined
          }
        />
        <StatCard
          label="Friends and groups"
          icon={<Users />}
          value={friends.length + groups.length || ''}
          hint={`${plural(friends.length, 'friend')} · ${plural(groups.length, 'group')}`}
        />
      </StatGrid>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Section
          title="Friends"
          description="One-on-one balances"
          icon={<UsersRound />}
          to="/friends"
          empty={friends.length === 0 && 'Add a friend to split one-on-one.'}
        >
          {friends.slice(0, PREVIEW).map((friend) => (
            <Item key={friend.id} size="sm" render={<Link to="/friends/$friendId" params={{ friendId: friend.id }} />}>
              <ItemMedia>
                <PersonAvatar name={friend.name} size="sm" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{friend.name}</ItemTitle>
              </ItemContent>
              <ItemActions className="text-right text-xs">
                <BalanceText balances={friend.balances} />
              </ItemActions>
            </Item>
          ))}
        </Section>

        <Section
          title="Groups"
          description="Trips, flats and dinners"
          icon={<Users />}
          to="/groups"
          empty={groups.length === 0 && 'Start a group for a trip or a flat.'}
        >
          {groups.slice(0, PREVIEW).map((group) => (
            <Item key={group.id} size="sm" render={<Link to="/groups/$groupId" params={{ groupId: group.id }} />}>
              <ItemContent>
                <ItemTitle>{group.name}</ItemTitle>
                <ItemDescription>
                  {group.memberCount} members ·{' '}
                  {formatMoney(group.totalCents, group.currency)} total
                </ItemDescription>
              </ItemContent>
              <ItemActions className="text-xs">
                {group.myNetCents === 0 ? (
                  <span className="text-muted-foreground">Square</span>
                ) : (
                  <SignedAmount cents={group.myNetCents} currency={group.currency} />
                )}
              </ItemActions>
            </Item>
          ))}
        </Section>

        <Section
          title="Personal"
          description={formatMonth(month)}
          icon={<Wallet />}
          to="/personal"
          empty={
            personal.items.length === 0 &&
            `No personal expenses in ${formatMonth(month)} yet.`
          }
        >
          {personal.items.slice(0, PREVIEW).map((expense) => (
            <Item key={expense.id} size="sm">
              <ItemContent>
                <ItemTitle>{expense.description}</ItemTitle>
                <ItemDescription>
                  {formatDate(expense.date)} · {categoryLabel(expense.category)}
                </ItemDescription>
              </ItemContent>
              <ItemActions className="font-semibold tabular-nums">
                {formatMoney(expense.amountCents, expense.currency)}
              </ItemActions>
            </Item>
          ))}
        </Section>
      </div>
    </>
  )
}

function Section({
  title,
  description,
  icon,
  to,
  empty,
  children,
}: {
  title: string
  description: string
  icon: React.ReactNode
  to: '/friends' | '/groups' | '/personal'
  empty: string | false
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="grid size-7 place-items-center rounded-lg bg-primary/15 text-primary [&_svg]:size-4">
            {icon}
          </span>
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <Link
            to={to}
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'no-underline')}
          >
            View all
            <ArrowRight />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2">
        {empty ? (
          <Empty className="py-6">
            <EmptyHeader>
              <EmptyTitle className="text-sm font-medium">Nothing here yet</EmptyTitle>
              <EmptyDescription>{empty}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ItemGroup>{children}</ItemGroup>
        )}
      </CardContent>
    </Card>
  )
}
