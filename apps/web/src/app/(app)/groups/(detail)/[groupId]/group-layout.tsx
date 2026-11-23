'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowRight, ChartColumn, HandCoins, Pencil, Plus, Receipt } from 'lucide-react'

import { RecentPayments, RecordPaymentDialog } from '#/components/group-payments'
import { PersonAvatar, SignedAmount } from '#/components/ledger'
import { NavLink } from '#/components/nav-link'
import { PageHeader, SplitLayout } from '#/components/page-header'
import { useGroup } from '#/components/use-group'
import { Badge } from '#/components/ui/badge'
import { Button, buttonVariants } from '#/components/ui/button'
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
import { formatMoney, memberName } from '@settlr/shared/format'
import type { Group } from '#/lib/types'
import { cn } from '#/lib/utils'

// Page links styled as Gr8r's underlined tabs (its project view tabs): muted
// labels on a hairline, the current one in the text colour over a 2px bar.
const tabLink =
  "relative inline-flex h-9 items-center gap-1.5 px-2.5 text-ui font-medium text-muted-foreground no-underline transition-colors duration-140 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset data-[status=active]:text-foreground data-[status=active]:after:absolute data-[status=active]:after:inset-x-2 data-[status=active]:after:-bottom-px data-[status=active]:after:h-0.5 data-[status=active]:after:rounded-full data-[status=active]:after:bg-foreground data-[status=active]:after:content-[''] [&_svg]:size-3.5"

/** A group's header, section tabs and balances around its pages. */
export function GroupLayoutView({ children }: { children: React.ReactNode }) {
  const group = useGroup()
  // The add/edit expense form has its own split panel (and shows what the
  // expense does to your balance), so it gets the full width.
  const isForm = usePathname().includes('/expenses/')

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

      {isForm ? (
        children
      ) : (
        <SplitLayout aside={<Balances group={group} />}>
          <nav aria-label="Group sections" className="flex gap-0.5 overflow-x-auto border-b [scrollbar-width:none]">
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
      )}
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
        <CardDescription>Paid minus share, after payments.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ul className="grid gap-2.5">
          {group.members.map((m) => (
            <li key={m.id} className="flex items-center gap-2.5 text-sm">
              <PersonAvatar name={m.name} me={m.id === group.meMemberId} size="sm" />
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

        {/* The dashboard's "Settle" buttons link here. */}
        <div id="settle-up" className="grid scroll-mt-24 gap-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="m-0 text-sm font-medium">Settle up</h3>
            <RecordPaymentDialog
              group={group}
              trigger={
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  <HandCoins />
                  Other payment
                </Button>
              }
            />
          </div>
          {group.settlements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Everyone is square.</p>
          ) : (
            <ul className="grid gap-2">
              {group.settlements.map((s) => (
                <li
                  key={`${s.from}-${s.to}`}
                  className="flex items-center gap-2 rounded-lg bg-field py-2.5 pr-2.5 pl-3 text-sm"
                >
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium">{name(s.from)}</span>
                      <ArrowRight
                        className="size-3.5 shrink-0 text-muted-foreground"
                        aria-label="pays"
                      />
                      <span className="truncate font-medium">
                        {s.to === group.meMemberId ? 'you' : name(s.to)}
                      </span>
                    </span>
                    <span className="text-sm font-medium tabular-nums">
                      {formatMoney(s.amountCents, group.currency)}
                    </span>
                  </span>
                  <RecordPaymentDialog
                    group={group}
                    from={s.from}
                    to={s.to}
                    amountCents={s.amountCents}
                    trigger={
                      <Button
                        size="sm"
                        variant={s.from === group.meMemberId ? 'contrast' : 'outline'}
                        aria-label={`Record that ${name(s.from)} paid ${s.to === group.meMemberId ? 'you' : name(s.to)}`}
                      >
                        Record
                      </Button>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <RecentPayments group={group} />
      </CardContent>
    </Card>
  )
}
