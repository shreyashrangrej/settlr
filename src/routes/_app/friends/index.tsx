import { useState } from 'react'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ChevronRight, UserPlus, UsersRound } from 'lucide-react'

import { PageHeader, SplitLayout } from '#/components/page-header'
import {
  BalanceText,
  PersonAvatar,
  sumBalances,
  useAction,
} from '#/components/ledger'
import { Button } from '#/components/ui/button'
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
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '#/components/ui/item'
import { Spinner } from '#/components/ui/spinner'
import { formatBalances } from '#/lib/format'
import { addFriendInput } from '#/lib/schemas'
import { api } from '#convex/_generated/api'

// SSR: full. The loader prefetches the friends list over HTTP during SSR;
// in the browser it stays subscribed, so balances update live.
export const Route = createFileRoute('/_app/friends/')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(convexQuery(api.friends.list, {})),
  head: () => ({ meta: [{ title: 'Friends · Settlr' }] }),
  component: FriendsPage,
})

function FriendsPage() {
  const { data: friends } = useSuspenseQuery(convexQuery(api.friends.list, {}))
  const { owed, owe } = sumBalances(friends.map((f) => f.balances))

  return (
    <>
      <PageHeader
        title="Friends"
        description="One-on-one expenses and settle-ups, outside any group."
      />

      <SplitLayout aside={<AddFriend />}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card size="sm">
            <CardHeader>
              <CardDescription>Friends owe you</CardDescription>
              <CardTitle className="text-2xl font-bold text-positive tabular-nums">
                {formatBalances(owed) || '—'}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardDescription>You owe friends</CardDescription>
              <CardTitle className="text-2xl font-bold text-destructive tabular-nums">
                {formatBalances(owe) || '—'}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

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
          <Card className="py-2">
            <CardContent className="px-2">
              <ItemGroup>
                {friends.map((friend) => (
                  <Item
                    key={friend.id}
                    render={
                      <Link to="/friends/$friendId" params={{ friendId: friend.id }} />
                    }
                  >
                    <ItemMedia>
                      <PersonAvatar name={friend.name} />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>{friend.name}</ItemTitle>
                      {friend.email && (
                        <ItemDescription>{friend.email}</ItemDescription>
                      )}
                    </ItemContent>
                    <ItemActions className="text-right text-sm">
                      <BalanceText balances={friend.balances} />
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
            </CardContent>
          </Card>
        )}
      </SplitLayout>
    </>
  )
}

function AddFriend() {
  const createFriend = useConvexMutation(api.friends.create)
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const { run, pending, error, setError } = useAction(createFriend, {
    success: 'Friend added',
  })

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const parsed = addFriendInput.safeParse({ name, email })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form')
      return
    }
    const created = await run(parsed.data)
    if (created) {
      await navigate({
        to: '/friends/$friendId',
        params: { friendId: created.value },
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="size-4 text-primary" aria-hidden="true" />
          Add a friend
        </CardTitle>
        <CardDescription>They don’t need a Settlr account.</CardDescription>
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
