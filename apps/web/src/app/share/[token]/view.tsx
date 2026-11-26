'use client'

import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Eye } from 'lucide-react'

import { CategoryIcon } from '#/components/category'
import { PersonAvatar, SignedAmount } from '#/components/ledger'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '#/components/ui/empty'
import { Spinner } from '#/components/ui/spinner'
import { formatDate, formatMoney, memberName, plural } from '@settlr/shared/format'
import { api } from '@settlr/backend/convex/_generated/api'

export function SharedGroupView({ token }: { token: string }) {
  const { data, isPending } = useQuery(convexQuery(api.groups.shared, { token }))
  if (isPending) return <Spinner className="mx-auto mt-10" />
  if (!data) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>This link doesn’t work</EmptyTitle>
          <EmptyDescription>The group’s owner may have turned sharing off.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  const name = (id: string) => memberName(data.members, id)
  return (
    <div className="mx-auto grid max-w-4xl gap-4 px-4 py-6 sm:px-6">
      <header className="grid gap-1">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Eye className="size-3.5" /> Read-only view
        </p>
        <h1 className="m-0 text-2xl font-semibold">{data.name}</h1>
        <p className="m-0 text-sm text-muted-foreground">
          {plural(data.members.length, 'member')} · {formatMoney(data.totalCents, data.currency)} across{' '}
          {plural(data.expenseCount, 'expense')}
        </p>
      </header>
      <div className="flex flex-wrap gap-4">
        <Card className="flex-[1_1_18rem]">
          <CardHeader>
            <CardTitle>Balances</CardTitle>
            <CardDescription>Paid minus share, after payments.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="m-0 grid list-none gap-2.5 p-0">
              {data.members.map((m) => (
                <li key={m.id} className="flex items-center gap-2.5 text-sm">
                  <PersonAvatar name={m.name} size="sm" />
                  <span className="flex-1 truncate">{m.name}</span>
                  <SignedAmount cents={m.netCents} currency={data.currency} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card className="flex-[1_1_18rem]">
          <CardHeader>
            <CardTitle>Settle up</CardTitle>
            <CardDescription>The fewest payments that square everyone.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.settlements.length === 0 ? (
              <p className="m-0 text-sm text-muted-foreground">Everyone is square.</p>
            ) : (
              <ul className="m-0 grid list-none gap-2 p-0">
                {data.settlements.map((s) => (
                  <li key={`${s.from}-${s.to}`} className="flex items-center gap-2 rounded-lg bg-field px-3 py-2 text-sm">
                    <span className="font-medium">{name(s.from)}</span>
                    <ArrowRight className="size-3.5 text-muted-foreground" aria-label="pays" />
                    <span className="flex-1 font-medium">{name(s.to)}</span>
                    <span className="tabular-nums">{formatMoney(s.amountCents, data.currency)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      <Card className="p-0">
        <CardHeader className="p-3.5">
          <CardTitle>Latest expenses</CardTitle>
        </CardHeader>
        <ul className="m-0 list-none p-0">
          {data.expenses.map((e) => (
            <li key={e.id} className="flex items-center gap-3 border-t border-divider px-3.5 py-2.5">
              <CategoryIcon category={e.category} />
              <span className="grid min-w-0 flex-1">
                <span className="truncate font-medium">{e.description}</span>
                <span className="truncate text-xs text-faint">
                  {formatDate(e.date)} · {name(e.paidBy)} paid · split{' '}
                  {Object.keys(e.owed).length === data.members.length
                    ? 'by everyone'
                    : `by ${Object.keys(e.owed).map(name).join(', ')}`}
                </span>
              </span>
              <span className="font-medium tabular-nums">{formatMoney(e.amountCents, data.currency)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
