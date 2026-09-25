import { createFileRoute } from '@tanstack/react-router'
import { ChartColumn, Clock, Receipt, Users, Wallet } from 'lucide-react'

import { StatCard, StatGrid } from '#/components/stat-card'
import { useGroup } from '#/components/use-group'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '#/components/ui/empty'
import { Progress, ProgressLabel, ProgressValue } from '#/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { categoryLabel } from '#/lib/format'
import type { Group } from '#/lib/types'

// SSR: data-only. The group is already loaded by the layout (its totals are
// kept on the group document), but this component only renders in the
// browser: everything here is formatted in the viewer's own locale, time
// zone and clock ("3 days ago"), which the server cannot know and would
// otherwise cause hydration mismatches. The server sends the pending
// component in its place.
export const Route = createFileRoute('/_app/groups/$groupId/insights')({
  ssr: 'data-only',
  head: () => ({ meta: [{ title: 'Insights · Settlr' }] }),
  component: InsightsPage,
})

function InsightsPage() {
  const group = useGroup()
  if (!group) return null

  if (group.totalCents === 0) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ChartColumn />
          </EmptyMedia>
          <EmptyTitle>No insights yet</EmptyTitle>
          <EmptyDescription>Add some expenses to see where the money goes.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  // The browser's default locale as resolved by Intl. Safe here because this
  // component never renders on the server. (Not `navigator.language`, which
  // can be an invalid tag such as "en-US@posix" and make Intl throw.)
  const locale = new Intl.NumberFormat().resolvedOptions().locale
  const money = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: group.currency,
  })
  const format = (cents: number) => money.format(cents / 100)
  const monthFormat = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

  return (
    <div className="grid gap-4">
      <StatGrid>
        <StatCard label="Total spent" icon={<Wallet />} value={format(group.totalCents)} />
        <StatCard
          label="Expenses"
          icon={<Receipt />}
          value={group.expenseCount}
          hint={`Avg ${format(Math.round(group.totalCents / group.expenseCount))}`}
        />
        <StatCard
          label="Per member"
          icon={<Users />}
          value={format(Math.round(group.totalCents / group.members.length))}
          hint={`${group.members.length} members`}
        />
        <StatCard
          label="Last expense"
          icon={<Clock />}
          value={group.lastExpenseAt ? relativeTime(group.lastExpenseAt, locale) : ''}
        />
      </StatGrid>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(22rem,1fr))] items-start gap-4">

      <BarCard
        title="By category"
        rows={group.byCategory.map((row) => ({
          key: row.category,
          label: categoryLabel(row.category),
          value: row.cents,
        }))}
        format={format}
      />

      <BarCard
        title="By month"
        rows={group.byMonth.map((row) => ({
          key: row.month,
          label: monthFormat.format(new Date(`${row.month}-01T00:00:00Z`)),
          value: row.cents,
        }))}
        format={format}
      />

      <MemberShares group={group} format={format} />
      </div>
    </div>
  )
}

function MemberShares({
  group,
  format,
}: {
  group: Group
  format: (cents: number) => string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Paid vs. share</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Share</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {group.members.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">
                  {m.name}
                  {m.id === group.meMemberId && (
                    <span className="text-muted-foreground"> (you)</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{format(m.paidCents)}</TableCell>
                <TableCell className="text-right tabular-nums">{format(m.owedCents)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function BarCard({
  title,
  rows,
  format,
}: {
  title: string
  rows: Array<{ key: string; label: string; value: number }>
  format: (cents: number) => string
}) {
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {rows.map((row) => (
          <Progress key={row.key} value={(row.value / max) * 100}>
            <ProgressLabel className="text-sm">{row.label}</ProgressLabel>
            <ProgressValue className="ml-auto text-sm font-semibold tabular-nums">
              {() => format(row.value)}
            </ProgressValue>
          </Progress>
        ))}
      </CardContent>
    </Card>
  )
}

function relativeTime(epochMs: number, locale: string) {
  const seconds = (epochMs - Date.now()) / 1000
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ]
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit)
  }
  return rtf.format(Math.round(seconds), 'second')
}
