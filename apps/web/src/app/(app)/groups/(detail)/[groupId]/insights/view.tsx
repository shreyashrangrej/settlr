'use client'

import { ChartColumn } from 'lucide-react'

import { PersonAvatar } from '#/components/ledger'
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
import { categoryLabel } from '@settlr/shared/format'
import type { Group } from '#/lib/types'

export function InsightsView() {
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
    <Card className="gap-0 pb-0">
      <CardHeader className="pb-2.5">
        <CardTitle>Paid vs. share</CardTitle>
      </CardHeader>
      {/* The table runs edge to edge (see ui/table.tsx). */}
      <CardContent className="px-0">
        <Table className="table-fixed">
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
                  <span className="flex min-w-0 items-center gap-2.5">
                    <PersonAvatar name={m.name} me={m.id === group.meMemberId} />
                    <span className="truncate">
                      {m.name}
                      {m.id === group.meMemberId && (
                        <span className="font-normal text-faint"> (you)</span>
                      )}
                    </span>
                  </span>
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
            <ProgressValue className="ml-auto text-sm font-medium tabular-nums">
              {() => format(row.value)}
            </ProgressValue>
          </Progress>
        ))}
      </CardContent>
    </Card>
  )
}
