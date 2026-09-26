'use client'

import { useState } from 'react'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import Link from 'next/link'
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  CircleCheck,
  UserPlus,
  UsersRound,
} from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader, SplitLayout } from '#/components/page-header'
import { StatCard, StatGrid } from '#/components/stat-card'
import {
  BalanceText,
  FriendStatusBadge,
  PersonAvatar,
  sumBalances,
  useAction,
} from '#/components/ledger'
import { useAppRouter } from '#/components/navigation-progress'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
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
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Spinner } from '#/components/ui/spinner'
import { formatBalances } from '#/lib/format'
import { addFriendInput } from '#/lib/schemas'
import { api } from '#convex/_generated/api'

export function FriendsView() {
  const { data: friends } = useSuspenseQuery(convexQuery(api.friends.list, {}))
  const { owed, owe } = sumBalances(friends.map((f) => f.balances))
  const settled = friends.filter((f) => Object.keys(f.balances).length === 0).length

  return (
    <>
      <PageHeader
        title="Friends"
        description="One-on-one expenses and settle-ups, outside any group."
      />

      <SplitLayout aside={<AddFriend />}>
        <StatGrid>
          <StatCard
            label="Friends owe you"
            icon={<ArrowDownLeft />}
            tone="positive"
            value={formatBalances(owed)}
          />
          <StatCard
            label="You owe friends"
            icon={<ArrowUpRight />}
            tone="negative"
            value={formatBalances(owe)}
          />
          <StatCard label="Friends" icon={<UsersRound />} value={friends.length || ''} />
          <StatCard
            label="Settled up"
            icon={<CircleCheck />}
            value={friends.length ? `${settled} of ${friends.length}` : ''}
          />
        </StatGrid>

        {friends.length === 0 ? (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UsersRound />
              </EmptyMedia>
              <EmptyTitle>No friends yet</EmptyTitle>
              <EmptyDescription>
                Add someone to start tracking what you owe each other.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4">
            {friends.map((friend) => (
              <li key={friend.id}>
                <Link
                  href={`/friends/${friend.id}`}
                  className="block h-full rounded-xl no-underline outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <Card size="sm" className="h-full transition-shadow hover:ring-primary/50">
                    <CardHeader>
                      <div className="flex min-w-0 items-center gap-3">
                        <PersonAvatar name={friend.name} size="lg" />
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <CardTitle className="truncate">{friend.name}</CardTitle>
                          {friend.email && (
                            <CardDescription className="truncate" title={friend.email}>
                              {friend.email}
                            </CardDescription>
                          )}
                        </div>
                      </div>
                      <CardAction>
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </CardAction>
                    </CardHeader>
                    <CardContent className="mt-auto flex flex-wrap items-end justify-between gap-2 text-sm">
                      <BalanceText
                        balances={friend.balances}
                        className="justify-items-start"
                      />
                      <FriendStatusBadge status={friend.status} />
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SplitLayout>
    </>
  )
}

function AddFriend() {
  const createFriend = useConvexMutation(api.friends.create)
  const router = useAppRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const { run, pending, error, setError } = useAction(createFriend)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const parsed = addFriendInput.safeParse({ name, email })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form')
      return
    }
    const created = await run(parsed.data)
    if (created) {
      toast.success(
        parsed.data.email
          ? `Friend added. We sent ${parsed.data.email} a friend request.`
          : 'Friend added',
      )
      router.push(`/friends/${created.value}`)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="size-4 text-primary" aria-hidden="true" />
          Add a friend
        </CardTitle>
        <CardDescription>
          Add their email to send a friend request. Once they accept, you
          both see the same expenses and get notified of new ones.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form noValidate onSubmit={onSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="friend-name">Name</FieldLabel>
              <Input
                id="friend-name"
                value={name}
                maxLength={60}
                placeholder="Priya Shah"
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="friend-email">
                Email
                <span className="font-normal text-muted-foreground">(optional)</span>
              </FieldLabel>
              <Input
                id="friend-email"
                type="email"
                value={email}
                maxLength={254}
                placeholder="priya@example.com"
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" size="lg" disabled={pending}>
              {pending && <Spinner />}
              Add friend
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
