'use client'

import { convexQuery } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Plus, Users } from 'lucide-react'

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
import { cn } from '#/lib/utils'
import { api } from '#convex/_generated/api'

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
        actions={<NewGroupLink />}
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
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4.5">
          {groups.map((group) => (
            <li key={group.id}>
              <GroupTile
                group={group}
                className="h-full rounded-3xl border-border bg-card p-5"
              />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
