'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useConvexMutation } from '@convex-dev/react-query'
import { toast } from 'sonner'
import {
  ArrowRight,
  BellRing,
  ChartColumn,
  HandCoins,
  Pencil,
  Plus,
  Receipt,
  Scale,
  Users,
  Wallet,
} from 'lucide-react'

import { groupColor, labelTint } from '#/components/category'
import { ExpenseDialog } from '#/components/expense-dialog'
import { ExpensePage, PageIcon } from '#/components/expense-page'
import { GroupMenu } from '#/components/group-menu'
import { RecentPayments, RecordPaymentDialog } from '#/components/group-payments'
import { PersonAvatar, SignedAmount, useAction } from '#/components/ledger'
import { UpiPay } from '#/components/upi'
import { Progress } from '#/components/ui/progress'
import { PageHeader } from '#/components/page-header'
import { StatCard, StatGrid } from '#/components/stat-card'
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
import { formatMoney, memberName, plural } from '@settlr/shared/format'
import type { Group } from '#/lib/types'
import { cn } from '#/lib/utils'
import { api } from '@settlr/backend/convex/_generated/api'

/**
 * A group's header, figures and balances around its pages, in the frame
 * every expense page shares. The expenses list and Insights are two pages;
 * a header button switches between them (no tab row, so the group lines up
 * with the friend, personal and all-expenses pages).
 */
export function GroupLayoutView({ children }: { children: React.ReactNode }) {
  const group = useGroup()
  const pathname = usePathname()
  const onInsights = pathname.endsWith('/insights')

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
        media={
          <PageIcon style={labelTint(groupColor(group.id))}>
            <Users />
          </PageIcon>
        }
        title={
          <span className="flex items-center gap-3">
            {group.name}
            <Badge variant="secondary" className="font-normal">
              {group.currency}
            </Badge>
            {!group.isOwner && <Badge variant="outline">Shared with you</Badge>}
            {group.archived && <Badge variant="outline">Archived</Badge>}
          </span>
        }
        description={`${group.members.length} members · ${formatMoney(group.totalCents, group.currency)} spent`}
        actions={
          <>
            {onInsights ? (
              <Link
                href={`/groups/${group.id}`}
                className={cn(buttonVariants({ variant: 'outline' }), 'no-underline')}
              >
                <Receipt />
                Expenses
              </Link>
            ) : (
              <Link
                href={`/groups/${group.id}/insights`}
                className={cn(buttonVariants({ variant: 'outline' }), 'no-underline')}
              >
                <ChartColumn />
                Insights
              </Link>
            )}
            <GroupMenu group={group} />
            {group.isOwner && (
              <Link
                href={`/groups/${group.id}/edit`}
                className={cn(buttonVariants({ variant: 'outline' }), 'no-underline')}
              >
                <Pencil />
                Edit group
              </Link>
            )}
            <RecordPaymentDialog
              group={group}
              trigger={
                <Button variant="outline">
                  <HandCoins />
                  Settle up
                </Button>
              }
            />
            <ExpenseDialog target={{ kind: 'group', group }} trigger={<Button />}>
              <Plus />
              Add expense
            </ExpenseDialog>
          </>
        }
      />

      <ExpensePage
        stats={<GroupStats group={group} />}
        aside={
          <>
            <Balances group={group} />
            {group.budgetCents !== null && <BudgetCard group={group} />}
          </>
        }
      >
        {children}
      </ExpensePage>
    </>
  )
}

/** The group's figures: spending, where you stand, how many expenses and people. */
function GroupStats({ group }: { group: Group }) {
  const me = group.members.find((m) => m.id === group.meMemberId)
  const net = me?.netCents ?? 0
  return (
    <StatGrid>
      <StatCard
        label="Total spent"
        icon={<Wallet />}
        value={formatMoney(group.totalCents, group.currency)}
      />
      <StatCard
        label="Your balance"
        icon={<Scale />}
        tone={net > 0 ? 'positive' : net < 0 ? 'negative' : undefined}
        value={net === 0 ? 'Square' : `${net > 0 ? '+' : '−'}${formatMoney(Math.abs(net), group.currency)}`}
        hint={net > 0 ? 'You’re owed' : net < 0 ? 'You owe' : 'Nobody owes you'}
      />
      <StatCard
        label="Expenses"
        icon={<Receipt />}
        value={group.expenseCount || ''}
        hint={
          group.expenseCount > 0 &&
          `Avg ${formatMoney(Math.round(group.totalCents / group.expenseCount), group.currency)}`
        }
      />
      <StatCard
        label="Members"
        icon={<Users />}
        value={group.members.length}
        hint={
          group.totalCents > 0
            ? `${formatMoney(Math.round(group.totalCents / group.members.length), group.currency)} each`
            : plural(group.members.length, 'person', 'people')
        }
      />
    </StatGrid>
  )
}

function Balances({ group }: { group: Group }) {
  const name = (id: string) =>
    id === group.meMemberId ? 'You' : memberName(group.members, id)
  const upiOf = (id: string) => group.members.find((m) => m.id === id)?.upiId ?? null
  const isLinked = (id: string) => group.members.find((m) => m.id === id)?.linked ?? false

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
        <div id="settle-up" className="grid scroll-mt-15 gap-2 lg:scroll-mt-4">
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
                  {s.from === group.meMemberId &&
                    group.currency === 'INR' &&
                    upiOf(s.to) && (
                      <UpiPay
                        size="sm"
                        upiId={upiOf(s.to)!}
                        name={name(s.to)}
                        amountCents={s.amountCents}
                        note={`Settlr: ${group.name}`}
                      />
                    )}
                  {s.to === group.meMemberId && isLinked(s.from) && (
                    <RemindMember group={group} memberId={s.from} name={name(s.from)} />
                  )}
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

function RemindMember({ group, memberId, name }: { group: Group; memberId: string; name: string }) {
  const remind = useAction(useConvexMutation(api.groups.remindMember), { toastErrors: true })
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      aria-label={`Remind ${name}`}
      title={`Remind ${name}`}
      disabled={remind.pending}
      onClick={async () => {
        if (await remind.run({ groupId: group.id, memberId })) toast.success(`${name} was reminded`)
      }}
    >
      <BellRing />
    </Button>
  )
}

/** The group's budget against what it has spent. */
function BudgetCard({ group }: { group: Group }) {
  const budget = group.budgetCents ?? 0
  const left = budget - group.totalCents
  const pct = budget > 0 ? Math.min(100, Math.round((group.totalCents / budget) * 100)) : 0
  return (
    <Card>
      <CardHeader>
        <CardTitle>Budget</CardTitle>
        <CardDescription>{formatMoney(budget, group.currency)} for the group.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        <Progress
          value={pct}
          aria-label="Budget used"
          className={cn(left < 0 && '[&_[data-slot=progress-indicator]]:bg-destructive')}
        />
        <p className={cn('m-0', left < 0 ? 'text-destructive' : 'text-muted-foreground')}>
          {left >= 0
            ? `${formatMoney(left, group.currency)} left (${pct}% used)`
            : `${formatMoney(-left, group.currency)} over budget`}
        </p>
      </CardContent>
    </Card>
  )
}
