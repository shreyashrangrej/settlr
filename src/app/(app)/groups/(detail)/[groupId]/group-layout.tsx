'use client'

import Link from 'next/link'
import { ArrowRight, ChartColumn, Pencil, Plus, Receipt } from 'lucide-react'

import { PersonAvatar, SignedAmount } from '#/components/ledger'
import { NavLink } from '#/components/nav-link'
import { PageHeader, SplitLayout } from '#/components/page-header'
import { useGroup } from '#/components/use-group'
import { Badge } from '#/components/ui/badge'
import { buttonVariants } from '#/components/ui/button'
import {
  Card,
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
import { Separator } from '#/components/ui/separator'
import { tabsListVariants } from '#/components/ui/tabs'
import { formatMoney, memberName } from '#/lib/format'
import type { Group } from '#/lib/types'
import { cn } from '#/lib/utils'

// Page links styled like shadcn's TabsList/TabsTrigger.
const tabLink =
  'inline-flex h-full items-center gap-1.5 rounded-md px-3 text-sm font-medium text-muted-foreground no-underline transition-colors hover:text-foreground data-[status=active]:bg-background data-[status=active]:text-foreground data-[status=active]:shadow-sm dark:data-[status=active]:bg-input/30 [&_svg]:size-4'

/** A group's header, section tabs and balances around its pages. */
export function GroupLayoutView({ children }: { children: React.ReactNode }) {
  const group = useGroup()

  // Deleted while open (here or in another tab).
  if (!group) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>This group was deleted</EmptyTitle>
          <EmptyDescription>
            <Link href="/groups">Back to groups</Link>
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <>
      <PageHeader
        back={{ fallback: '/groups', label: 'Back' }}
        title={
          <span className="flex items-center gap-3">
            {group.name}
            <Badge variant="secondary">{group.currency}</Badge>
            {!group.isOwner && <Badge variant="outline">Shared with you</Badge>}
          </span>
        }
        description={`${group.members.length} members · ${formatMoney(group.totalCents, group.currency)} spent`}
        actions={
          <>
            {group.isOwner && (
              <Link
                href={`/groups/${group.id}/edit`}
                className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'no-underline')}
              >
                <Pencil />
                Edit group
              </Link>
            )}
            <Link
              href={`/groups/${group.id}/expenses/new`}
              className={cn(buttonVariants({ size: 'lg' }), 'no-underline')}
            >
              <Plus />
              Add expense
            </Link>
          </>
        }
      />

      <SplitLayout
        aside={<Balances group={group} />}
      >
        <nav
          aria-label="Group sections"
          className={cn(tabsListVariants(), 'h-9 bg-muted')}
        >
          <NavLink href={`/groups/${group.id}`} exact className={tabLink}>
            <Receipt />
            Expenses
          </NavLink>
          <NavLink href={`/groups/${group.id}/insights`} className={tabLink}>
            <ChartColumn />
            Insights
          </NavLink>
        </nav>
        {children}
      </SplitLayout>
    </>
  )
}

function Balances({ group }: { group: Group }) {
  const name = (id: string) =>
    id === group.meMemberId ? 'You' : memberName(group.members, id)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Balances</CardTitle>
        <CardDescription>Paid minus share, per member.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ul className="grid gap-2.5">
          {group.members.map((m) => (
            <li key={m.id} className="flex items-center gap-2.5 text-sm">
              <PersonAvatar name={m.name} size="sm" />
              <span className="min-w-0 flex-1 truncate">
                {m.name}
                {m.id === group.meMemberId && (
                  <span className="text-muted-foreground"> (you)</span>
                )}
              </span>
              <SignedAmount cents={m.netCents} currency={group.currency} />
            </li>
          ))}
        </ul>

        <Separator />

        <div className="grid gap-2">
          <h3 className="m-0 text-sm font-semibold">Settle up</h3>
          {group.settlements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Everyone is square.</p>
          ) : (
            <ul className="grid gap-2">
              {group.settlements.map((s) => (
                <li
                  key={`${s.from}-${s.to}`}
                  className="flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-2 text-sm"
                >
                  <span className="font-medium">{name(s.from)}</span>
                  <ArrowRight className="size-3.5 text-muted-foreground" aria-label="pays" />
                  <span className="font-medium">
                    {s.to === group.meMemberId ? 'you' : name(s.to)}
                  </span>
                  <span className="ml-auto font-semibold tabular-nums">
                    {formatMoney(s.amountCents, group.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
