'use client'

import { convexQuery } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { ArrowDownLeft, ArrowUpRight, Plus, Users, Wallet } from 'lucide-react'

import { BudgetProgress, spentIn } from '#/components/budget'
import {
  BalanceText,
  GroupAvatar,
  PersonAvatar,
  SignedAmount,
  sumBalances,
} from '#/components/ledger'
import { PageHeader, SplitLayout } from '#/components/page-header'
import { useSession } from '#/components/providers'
import { Panel, PanelList, PanelRow, Section, SectionLink } from '#/components/section'
import { Stat, StatStrip } from '#/components/stats'
import { buttonVariants } from '#/components/ui/button'
import {
  categoryLabel,
  formatBalances,
  formatDate,
  formatMoney,
  formatMonth,
  plural,
} from '#/lib/format'
import { cn } from '#/lib/utils'
import { api } from '#convex/_generated/api'

const PREVIEW = 5

/**
 * The signed-in home: one live summary of friends, groups and spending.
 * `month` and `today` come from the server, so both renders agree.
 */
export function DashboardView({ month, today }: { month: string; today: string }) {
  const { user } = useSession()
  const { data: friends } = useSuspenseQuery(convexQuery(api.friends.list, {}))
  const { data: groups } = useSuspenseQuery(convexQuery(api.groups.list, {}))
  const { data: personal } = useSuspenseQuery(
    convexQuery(api.personal.month, { month }),
  )
  const { data: budgets } = useSuspenseQuery(convexQuery(api.budgets.list, {}))
  const { data: spending } = useSuspenseQuery(
    convexQuery(api.budgets.monthSpending, { month }),
  )
  // Everything you spent this month (personal, plus your share with friends
  // and in groups) against the budget in its main currency.
  const mainSpend = spending[0]
  const budget = budgets.find(
    (b) => b.currency === (mainSpend?.currency ?? budgets[0]?.currency),
  )

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
              href="/personal"
              className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'no-underline')}
            >
              <Wallet />
              Log spending
            </Link>
            <Link
              href="/groups/new"
              className={cn(buttonVariants({ size: 'lg' }), 'no-underline')}
            >
              <Plus />
              New group
            </Link>
          </>
        }
      />

      <StatStrip className="mb-8">
        <Stat
          label="You are owed"
          icon={<ArrowDownLeft />}
          tone="positive"
          value={formatBalances(owed)}
        />
        <Stat
          label="You owe"
          icon={<ArrowUpRight />}
          tone="negative"
          value={formatBalances(owe)}
        />
        <Stat
          label={`Spent in ${formatMonth(month)}`}
          icon={<Wallet />}
          value={spending.map((t) => formatMoney(t.total, t.currency)).join(' + ')}
          hint="Personal, plus your share with friends and in groups"
        />
        <Stat
          label="Friends and groups"
          icon={<Users />}
          value={friends.length + groups.length || ''}
          hint={`${plural(friends.length, 'friend')} · ${plural(groups.length, 'group')}`}
        />
      </StatStrip>

      <SplitLayout
        aside={
          <>
            <Section
              title={formatMonth(month)}
              description="Your budget and latest spending"
              actions={<SectionLink href="/budget">Budget</SectionLink>}
            >
              {budget ? (
                <BudgetProgress
                  budget={budget}
                  spent={spentIn(spending, budget.currency)}
                  month={month}
                  today={today}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  No budget yet.{' '}
                  <Link href="/budget" className="font-medium text-primary">
                    Set one
                  </Link>{' '}
                  to see how the month is going.
                </p>
              )}
            </Section>

            <Section
              title="Recent personal spending"
              actions={<SectionLink href="/personal">All</SectionLink>}
            >
              {personal.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing logged in {formatMonth(month)} yet.
                </p>
              ) : (
                <ul className="-my-2 divide-y">
                  {personal.items.slice(0, PREVIEW).map((expense) => (
                    <li key={expense.id} className="flex items-center gap-3 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {expense.description}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {formatDate(expense.date)} · {categoryLabel(expense.category)}
                        </span>
                      </span>
                      <span className="text-sm font-semibold tabular-nums">
                        {formatMoney(expense.amountCents, expense.currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </>
        }
      >
        <Section
          title="Friends"
          description="One-on-one balances"
          actions={<SectionLink href="/friends">All friends</SectionLink>}
        >
          <Panel>
            {friends.length === 0 ? (
              <EmptyRow>
                Add a friend to split one-on-one. <Link href="/friends">Go to friends</Link>
              </EmptyRow>
            ) : (
              <PanelList>
                {friends.slice(0, PREVIEW).map((friend) => (
                  <PanelRow key={friend.id} href={`/friends/${friend.id}`}>
                    <PersonAvatar name={friend.name} />
                    <span className="min-w-0 flex-1 truncate font-medium">{friend.name}</span>
                    <BalanceText balances={friend.balances} className="text-right text-sm" />
                  </PanelRow>
                ))}
              </PanelList>
            )}
          </Panel>
        </Section>

        <Section
          title="Groups"
          description="Trips, flats and dinners"
          actions={<SectionLink href="/groups">All groups</SectionLink>}
        >
          <Panel>
            {groups.length === 0 ? (
              <EmptyRow>
                Start a group for a trip or a flat. <Link href="/groups/new">New group</Link>
              </EmptyRow>
            ) : (
              <PanelList>
                {groups.slice(0, PREVIEW).map((group) => (
                  <PanelRow key={group.id} href={`/groups/${group.id}`}>
                    <GroupAvatar name={group.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{group.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {group.memberCount} members ·{' '}
                        {formatMoney(group.totalCents, group.currency)} spent
                      </span>
                    </span>
                    {group.myNetCents === 0 ? (
                      <span className="text-sm text-muted-foreground">Square</span>
                    ) : (
                      <SignedAmount
                        cents={group.myNetCents}
                        currency={group.currency}
                        className="text-sm"
                      />
                    )}
                  </PanelRow>
                ))}
              </PanelList>
            )}
          </Panel>
        </Section>
      </SplitLayout>
    </>
  )
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 py-6 text-center text-sm text-muted-foreground [&_a]:font-medium [&_a]:text-primary">
      {children}
    </p>
  )
}
