'use client'

import { convexQuery } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { FileUp, Plus, Users } from 'lucide-react'

import { GroupTile } from '#/components/group-tile'
import { PageHeader } from '#/components/page-header'
import { buttonVariants } from '#/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '#/components/ui/empty'
import type { GroupSummary } from '#/lib/types'
import { cn } from '#/lib/utils'
import { api } from '@settlr/backend/convex/_generated/api'

function NewGroupLink({ className }: { className?: string }) {
  return (
    <Link
      href="/groups/new"
      className={cn(buttonVariants({ size: 'lg' }), 'no-underline', className)}
    >
      <Plus strokeWidth={2.4} />
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
        actions={
          <>
            <Link
              href="/groups/import"
              className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'no-underline')}
            >
              <FileUp />
              Import from Splitwise
            </Link>
            <NewGroupLink />
          </>
        }
      />

      {groups.length === 0 ? (
        <Empty className="border border-dashed">
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
        <div className="grid gap-6">
          <GroupGrid groups={groups.filter((g) => !g.archived)} />
          {groups.some((g) => g.archived) && (
            <section className="grid gap-3">
              <h2 className="m-0 text-2xs font-medium tracking-wide text-muted-foreground uppercase">
                Archived
              </h2>
              <GroupGrid groups={groups.filter((g) => g.archived)} />
            </section>
          )}
        </div>
      )}
    </>
  )
}

function GroupGrid({ groups }: { groups: Array<GroupSummary> }) {
  return (
    <ul className="stagger grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4">
      {groups.map((group) => (
        <li key={group.id}>
          <GroupTile group={group} className="h-full rounded-xl border-border bg-card p-3.5" />
        </li>
      ))}
    </ul>
  )
}
