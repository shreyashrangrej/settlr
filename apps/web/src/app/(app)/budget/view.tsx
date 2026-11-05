'use client'

import { convexQuery } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { PiggyBank, User, Users, UsersRound, Wallet } from 'lucide-react'

import { BudgetCard, type Spending } from '#/components/budget'
import { MonthNav } from '#/components/month-nav'
import { PageHeader, SplitLayout } from '#/components/page-header'
import { StatCard, StatGrid } from '#/components/stat-card'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '#/components/ui/empty'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { formatMoney, formatMonth } from '@settlr/shared/format'
import { api } from '@settlr/backend/convex/_generated/api'

const SOURCES = [
  { key: 'personal', label: 'Personal', icon: <User />, to: '/personal' },
  { key: 'friends', label: 'With friends', icon: <UsersRound />, to: '/friends' },
  { key: 'groups', label: 'In groups', icon: <Users />, to: '/groups' },
] as const

/**
 * The monthly budget for `month`. `thisMonth` and `today` come from the
 * server, so the server and client render the same days.
 */
export function BudgetView({
  month,
  thisMonth,
  today,
}: {
  month: string
  thisMonth: string
  today: string
}) {
  const { data: budgets } = useSuspenseQuery(convexQuery(api.budgets.list, {}))
  const { data: spending } = useSuspenseQuery(
    convexQuery(api.budgets.monthSpending, { month }),
  )
  const sum = (pick: (s: Spending) => number) =>
    spending
      .filter((s) => pick(s) > 0)
      .map((s) => formatMoney(pick(s), s.currency))
      .join(' + ')

  return (
    <>
      <PageHeader
        title="Monthly budget"
        description="Everything you spend: personal expenses plus your share with friends and in groups."
        actions={<MonthNav to="/budget" month={month} thisMonth={thisMonth} />}
      />

      <SplitLayout
        aside={
          <BudgetCard
            month={month}
            today={today}
            budgets={budgets}
            spending={spending}
            defaultCurrency={spending[0]?.currency}
          />
        }
      >
        <StatGrid>
          <StatCard label={`Spent in ${formatMonth(month)}`} icon={<Wallet />} value={sum((s) => s.total)} />
          {SOURCES.map((source) => (
            <StatCard
              key={source.key}
              label={source.label}
              icon={source.icon}
              value={sum((s) => s[source.key])}
            />
          ))}
        </StatGrid>

        <Card>
          <CardHeader>
            <CardTitle>Where it went</CardTitle>
            <CardDescription>
              Your share of each expense; settle-up payments don’t count.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {spending.length === 0 ? (
              <Empty className="py-10">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <PiggyBank />
                  </EmptyMedia>
                  <EmptyTitle>Nothing spent in {formatMonth(month)}</EmptyTitle>
                  <EmptyDescription>
                    Expenses you log or share show up here.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              // Laid out like a group's expenses: an icon tile and the name,
              // with the currency and share as the line under it.
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead className="hidden w-48 md:table-cell">Share of spending</TableHead>
                    <TableHead className="w-32 text-right">Spent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {spending.flatMap((row) =>
                    SOURCES.filter((source) => row[source.key] > 0).map((source) => {
                      const share = Math.round((row[source.key] / row.total) * 100)
                      return (
                        <TableRow key={`${row.currency}:${source.key}`}>
                          <TableCell className="font-medium">
                            <span className="flex items-center gap-3">
                              <span
                                aria-hidden="true"
                                className="grid size-8.5 shrink-0 place-items-center rounded-[10px] bg-tile text-primary [&_svg]:size-4"
                              >
                                {source.icon}
                              </span>
                              <span className="grid min-w-0">
                                <Link
                                  href={source.to}
                                  className="truncate text-foreground no-underline hover:text-primary"
                                >
                                  {source.label}
                                </Link>
                                <span className="truncate text-xs font-normal text-muted-foreground">
                                  {row.currency}
                                  <span className="md:hidden"> · {share}% of spending</span>
                                </span>
                              </span>
                            </span>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <span className="flex items-center gap-2.5">
                              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-segment">
                                <span
                                  className="block h-full rounded-full bg-primary"
                                  style={{ width: `${share}%` }}
                                />
                              </span>
                              <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">
                                {share}%
                              </span>
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium tabular-nums">
                            {formatMoney(row[source.key], row.currency)}
                          </TableCell>
                        </TableRow>
                      )
                    }),
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </SplitLayout>
    </>
  )
}
