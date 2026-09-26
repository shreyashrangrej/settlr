'use client'

import { convexQuery } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { ChevronRight, Plus, Users } from 'lucide-react'

import { GroupAvatar, SignedAmount } from '#/components/ledger'
import { PageHeader } from '#/components/page-header'
import { Panel, PanelList, PanelRow } from '#/components/section'
import { Badge } from '#/components/ui/badge'
import { buttonVariants } from '#/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '#/components/ui/empty'
import { formatMoney, plural } from '#/lib/format'
import { cn } from '#/lib/utils'
import { api } from '#convex/_generated/api'

function NewGroupLink({ className }: { className?: string }) {
  return (
    <Link
      href="/groups/new"
      className={cn(buttonVariants({ size: 'lg' }), 'no-underline', className)}
    >
      <Plus />
      New group
    </Link>
  )
}

export function GroupsView() {
  const { data: groups } = useSuspenseQuery(convexQuery(api.groups.list, {}))

  return (
    <>
      <PageHeader
        title="Groups"
        description="Trips, flats and dinners: shared tabs and who owes whom."
        actions={<NewGroupLink />}
      />

      <Panel>
        {groups.length === 0 ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Users />
              </EmptyMedia>
              <EmptyTitle>No groups yet</EmptyTitle>
              <EmptyDescription>
                Create a group for a trip, a flat or a regular dinner.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <NewGroupLink />
            </EmptyContent>
          </Empty>
        ) : (
          <PanelList>
            {groups.map((group) => (
              <PanelRow key={group.id} href={`/groups/${group.id}`} className="gap-4">
                <GroupAvatar name={group.name} className="size-10" />
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium">{group.name}</span>
                    {!group.isOwner && <Badge variant="outline">Shared</Badge>}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {group.memberCount} members · {plural(group.expenseCount, 'expense')}
                    <span className="sm:hidden">
                      {' '}· {formatMoney(group.totalCents, group.currency)}
                    </span>
                  </span>
                </span>
                <span className="hidden w-36 text-right sm:block">
                  <span className="block text-sm font-semibold tabular-nums">
                    {formatMoney(group.totalCents, group.currency)}
                  </span>
                  <span className="block text-xs text-muted-foreground">Total spent</span>
                </span>
                <span className="w-32 text-right">
                  {group.myNetCents === 0 ? (
                    <span className="text-sm text-muted-foreground">You’re square</span>
                  ) : (
                    <>
                      <SignedAmount
                        cents={group.myNetCents}
                        currency={group.currency}
                        className="block text-sm"
                      />
                      <span className="block text-xs text-muted-foreground">
                        {group.myNetCents > 0 ? 'You’re owed' : 'You owe'}
                      </span>
                    </>
                  )}
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </PanelRow>
            ))}
          </PanelList>
        )}
      </Panel>
    </>
  )
}
