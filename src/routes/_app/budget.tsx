import { convexQuery } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { PiggyBank, User, Users, UsersRound, Wallet } from 'lucide-react'

import { BudgetCard, type Spending } from '#/components/budget'
import { MonthNav } from '#/components/month-nav'
import { PageHeader, SplitLayout } from '#/components/page-header'
import { BudgetSkeleton } from '#/components/skeletons'
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
import { currentMonth, formatMoney, formatMonth, todayIsoDate } from '#/lib/format'
import { monthSearchDefaults, monthSearchSchema } from '#/lib/schemas'
import { api } from '#convex/_generated/api'

// SSR: full. The monthly budget, on its own page because it covers all your
// spending: personal expenses plus your share with friends and in groups.
// `?month=2026-09` picks the month (none means this month); like the
// personal page, the loader resolves "this month" and "today" once.
export const Route = createFileRoute('/_app/budget')({
  validateSearch: monthSearchSchema,
  search: { middlewares: [stripSearchParams(monthSearchDefaults)] },
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    const month = deps.month || currentMonth()
    await Promise.all([
      context.queryClient.ensureQueryData(convexQuery(api.budgets.list, {})),
      context.queryClient.ensureQueryData(convexQuery(api.budgets.monthSpending, { month })),
    ])
    return { month, thisMonth: currentMonth(), today: todayIsoDate() }
  },
  head: () => ({ meta: [{ title: 'Monthly budget · Settlr' }] }),
  pendingComponent: BudgetSkeleton,
  component: BudgetPage,
})

const SOURCES = [
  { key: 'personal', label: 'Personal', icon: <User />, to: '/personal' },
  { key: 'friends', label: 'With friends', icon: <UsersRound />, to: '/friends' },
  { key: 'groups', label: 'In groups', icon: <Users />, to: '/groups' },
] as const

function BudgetPage() {
  const { month, thisMonth, today } = Route.useLoaderData()
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

        <Card className="py-2">
          <CardHeader className="px-4 pt-2">
            <CardTitle>Where it went</CardTitle>
            <CardDescription>
              Your share of each expense; settle-up payments don’t count.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2">
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
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead className="hidden md:table-cell">Currency</TableHead>
                    <TableHead className="hidden md:table-cell">Share of spending</TableHead>
                    <TableHead className="text-right">Spent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {spending.flatMap((row) =>
                    SOURCES.filter((source) => row[source.key] > 0).map((source) => (
                      <TableRow key={`${row.currency}:${source.key}`}>
                        <TableCell>
                          <Link
                            to={source.to}
                            className="flex items-center gap-2 font-medium text-foreground no-underline hover:underline [&_svg]:size-4 [&_svg]:text-muted-foreground"
                          >
                            {source.icon}
                            <span className="truncate">{source.label}</span>
                          </Link>
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground md:table-cell">
                          {row.currency}
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground tabular-nums md:table-cell">
                          {Math.round((row[source.key] / row.total) * 100)}%
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {formatMoney(row[source.key], row.currency)}
                        </TableCell>
                      </TableRow>
                    )),
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
