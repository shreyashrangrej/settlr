'use client'

import { convexQuery } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { ChartPie, Receipt, TrendingDown, TrendingUp, Trophy, Wallet } from 'lucide-react'

import { CategoryIcon } from '#/components/category'
import { MonthNav } from '#/components/month-nav'
import { PageHeader, SplitLayout } from '#/components/page-header'
import { StatCard, StatGrid } from '#/components/stat-card'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { Progress } from '#/components/ui/progress'
import { categoryLabel, formatDate, formatMoney, formatMonth, shiftMonth } from '@settlr/shared/format'
import type { Currency } from '@settlr/shared/schemas'
import { api } from '@settlr/backend/convex/_generated/api'
import { recapArgs } from './args'

export function RecapView({ month, thisMonth }: { month: string; thisMonth: string }) {
  const { data: now } = useSuspenseQuery(convexQuery(api.expenses.month, recapArgs(month)))
  const { data: before } = useSuspenseQuery(
    convexQuery(api.expenses.month, recapArgs(shiftMonth(month, -1))),
  )
  const main = now.totals[0]
  const currency: Currency = main?.currency ?? before.totals[0]?.currency ?? 'USD'
  const share = main?.share ?? 0
  const prev = before.totals.find((t) => t.currency === currency)?.share ?? 0
  const change = prev > 0 ? Math.round(((share - prev) / prev) * 100) : null
  const categories = now.byCategory.filter((c) => c.currency === currency)
  const biggest = now.items.find((i) => i.currency === currency)
  const count = now.totals.reduce((n, t) => n + t.count, 0)

  return (
    <>
      <PageHeader
        title={`${formatMonth(month)} in review`}
        description="What you spent (your share), compared with the month before."
        actions={<MonthNav to="/recap" month={month} thisMonth={thisMonth} />}
      />
      {count === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nothing was spent in {formatMonth(month)}.
          </CardContent>
        </Card>
      ) : (
        <SplitLayout
          aside={
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="size-4 text-muted-foreground" />
                  Biggest expenses
                </CardTitle>
                <CardDescription>The whole amount, wherever it was.</CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="m-0 grid list-none gap-2.5 p-0">
                  {now.items.map((item) => (
                    <li key={item.key} className="flex items-center gap-2.5 text-sm">
                      <CategoryIcon category={item.category} />
                      <span className="grid min-w-0 flex-1">
                        <span className="truncate font-medium">{item.description}</span>
                        <span className="truncate text-xs text-faint">
                          {formatDate(item.date)} · {item.where?.name ?? 'Personal'}
                        </span>
                      </span>
                      <span className="font-medium tabular-nums">
                        {formatMoney(item.amountCents, item.currency)}
                      </span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          }
        >
          <StatGrid>
            <StatCard label="You spent" icon={<Wallet />} value={formatMoney(share, currency)} />
            <StatCard
              label={`vs ${formatMonth(shiftMonth(month, -1))}`}
              icon={change !== null && change > 0 ? <TrendingUp /> : <TrendingDown />}
              tone={change === null ? undefined : change > 0 ? 'negative' : 'positive'}
              value={change === null ? '—' : `${change > 0 ? '+' : ''}${change}%`}
              hint={prev ? `${formatMoney(prev, currency)} before` : 'Nothing the month before'}
            />
            <StatCard label="Expenses" icon={<Receipt />} value={count} />
            <StatCard
              label="Top category"
              icon={<ChartPie />}
              value={categories[0] ? categoryLabel(categories[0].category) : '—'}
              hint={categories[0] && formatMoney(categories[0].cents, currency)}
            />
          </StatGrid>
          <Card>
            <CardHeader>
              <CardTitle>Where it went</CardTitle>
              <CardDescription>
                Your share by category in {currency}
                {biggest && `. The biggest was ${biggest.description}.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {categories.map((c) => {
                const pct = share ? Math.round((c.cents / share) * 100) : 0
                return (
                  <div key={c.category} className="grid gap-1.5">
                    <div className="flex items-center gap-2.5 text-sm">
                      <CategoryIcon category={c.category} />
                      <span className="flex-1 font-medium">{categoryLabel(c.category)}</span>
                      <span className="text-muted-foreground tabular-nums">{pct}%</span>
                      <span className="w-28 text-right font-medium tabular-nums">
                        {formatMoney(c.cents, currency)}
                      </span>
                    </div>
                    <Progress value={pct} aria-label={`${categoryLabel(c.category)} share`} />
                  </div>
                )
              })}
              <div className="grid gap-1 border-t border-divider pt-3 text-sm">
                <span className="text-muted-foreground">By where it was</span>
                <span>
                  Groups {formatMoney(main?.group ?? 0, currency)} · Friends{' '}
                  {formatMoney(main?.friend ?? 0, currency)} · Personal{' '}
                  {formatMoney(main?.personal ?? 0, currency)}
                </span>
              </div>
            </CardContent>
          </Card>
        </SplitLayout>
      )}
    </>
  )
}
