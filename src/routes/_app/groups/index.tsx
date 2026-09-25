import { convexQuery } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Plus, Users } from 'lucide-react'

import { SignedAmount } from '#/components/ledger'
import { PageHeader } from '#/components/page-header'
import { buttonVariants } from '#/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '#/components/ui/empty'
import { Badge } from '#/components/ui/badge'
import { formatMoney } from '#/lib/format'
import { cn } from '#/lib/utils'
import { api } from '#convex/_generated/api'

// SSR: full. The group list belongs in the first HTML response; after
// hydration it stays live.
export const Route = createFileRoute('/_app/groups/')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(convexQuery(api.groups.list, {})),
  head: () => ({ meta: [{ title: 'Groups · Settlr' }] }),
  component: GroupsPage,
})

function NewGroupLink({ className }: { className?: string }) {
  return (
    <Link
      to="/groups/new"
      className={cn(buttonVariants({ size: 'lg' }), 'no-underline', className)}
    >
      <Plus />
      New group
    </Link>
  )
}

function GroupsPage() {
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
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {groups.map((group) => (
            <li key={group.id}>
              <Link
                to="/groups/$groupId"
                params={{ groupId: group.id }}
                className="block rounded-xl no-underline outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Card className="h-full transition-shadow hover:ring-primary/50">
                  <CardHeader>
                    <CardTitle className="text-base">{group.name}</CardTitle>
                    <CardDescription>
                      {group.memberCount} members · {group.expenseCount} expenses
                    </CardDescription>
                    <CardAction>
                      <Badge variant="secondary">{group.currency}</Badge>
                    </CardAction>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold tabular-nums">
                      {formatMoney(group.totalCents, group.currency)}
                    </p>
                    <p className="text-xs text-muted-foreground">Total spent</p>
                  </CardContent>
                  <CardFooter className="justify-between border-t py-3 text-sm">
                    {group.myNetCents === 0 ? (
                      <span className="text-muted-foreground">You’re square</span>
                    ) : (
                      <>
                        <span className="text-muted-foreground">
                          {group.myNetCents > 0 ? 'You’re owed' : 'You owe'}
                        </span>
                        <SignedAmount
                          cents={group.myNetCents}
                          currency={group.currency}
                        />
                      </>
                    )}
                  </CardFooter>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
