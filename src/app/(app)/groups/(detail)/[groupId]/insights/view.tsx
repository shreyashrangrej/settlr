'use client'

import { ChartColumn, Clock, Receipt, Users, Wallet } from 'lucide-react'

import { Panel } from '#/components/section'
import { Stat, StatStrip } from '#/components/stats'
import { useGroup } from '#/components/use-group'
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
import { cn } from '#/lib/utils'
import type { Group } from '#/lib/types'

export function InsightsView() {
  const group = useGroup()
  if (!group) return null

  if (group.totalCents === 0) {
    return (
      <Empty className="rounded-xl border border-dashed">
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
    <div className="grid gap-6">
      <StatStrip>
        <Stat label="Total spent" icon={<Wallet />} value={format(group.totalCents)} />
        <Stat
          label="Expenses"
          icon={<Receipt />}
          value={group.expenseCount}
          hint={`Avg ${format(Math.round(group.totalCents / group.expenseCount))}`}
        />
        <Stat
          label="Per member"
          icon={<Users />}
          value={format(Math.round(group.totalCents / group.members.length))}
          hint={`${group.members.length} members`}
        />
        <Stat
          label="Last expense"
          icon={<Clock />}
          value={group.lastExpenseAt ? relativeTime(group.lastExpenseAt, locale) : ''}
        />
      </StatStrip>

      {/* One panel, split by hairlines like the stat strip. */}
      <Panel className="grid gap-px bg-border md:grid-cols-2">
        <Bars
          title="By category"
          rows={group.byCategory.map((row) => ({
            key: row.category,
            label: categoryLabel(row.category),
            value: row.cents,
          }))}
          format={format}
        />
        <Bars
          title="By month"
          rows={group.byMonth.map((row) => ({
            key: row.month,
            label: monthFormat.format(new Date(`${row.month}-01T00:00:00Z`)),
            value: row.cents,
          }))}
          format={format}
        />
        <MemberShares group={group} format={format} />
      </Panel>
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
    <div className="grid gap-2 bg-card py-4 md:col-span-2">
      <h3 className="m-0 px-4 text-sm font-semibold">Paid vs. share</h3>
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead className="text-right">Paid</TableHead>
            <TableHead className="text-right">Share</TableHead>
            <TableHead className="text-right">Balance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {group.members.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="truncate font-medium">
                {m.name}
                {m.id === group.meMemberId && (
                  <span className="text-muted-foreground"> (you)</span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">{format(m.paidCents)}</TableCell>
              <TableCell className="text-right tabular-nums">{format(m.owedCents)}</TableCell>
              <TableCell
                className={cn(
                  'text-right font-semibold tabular-nums',
                  m.netCents > 0 && 'text-positive',
                  m.netCents < 0 && 'text-destructive',
                )}
              >
                {format(m.netCents)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function Bars({
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
    <div className="grid content-start gap-3 bg-card p-4">
      <h3 className="m-0 text-sm font-semibold">{title}</h3>
      {rows.map((row) => (
        <Progress key={row.key} value={(row.value / max) * 100}>
          <ProgressLabel className="text-sm">{row.label}</ProgressLabel>
          <ProgressValue className="ml-auto text-sm font-semibold tabular-nums">
            {() => format(row.value)}
          </ProgressValue>
        </Progress>
      ))}
    </div>
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
