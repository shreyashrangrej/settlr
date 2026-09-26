'use client'

import { useState } from 'react'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  CircleCheck,
  UserPlus,
  UsersRound,
} from 'lucide-react'
import { toast } from 'sonner'

import { FormDialog } from '#/components/edit-dialog'
import {
  BalanceText,
  FriendStatusBadge,
  PersonAvatar,
  sumBalances,
  useAction,
} from '#/components/ledger'
import { useAppRouter } from '#/components/navigation-progress'
import { PageHeader } from '#/components/page-header'
import { Panel, PanelList, PanelRow } from '#/components/section'
import { Stat, StatStrip } from '#/components/stats'
import { Button } from '#/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '#/components/ui/empty'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Spinner } from '#/components/ui/spinner'
import { formatBalances } from '#/lib/format'
import { addFriendInput } from '#/lib/schemas'
import { api } from '#convex/_generated/api'

function AddFriendButton() {
  return (
    <FormDialog
      title="Add a friend"
      description="Add their email to send a friend request. Once they accept, you both see the same expenses and get notified of new ones."
      trigger={
        <Button size="lg">
          <UserPlus />
          Add friend
        </Button>
      }
    >
      {(close) => <AddFriendForm onAdded={close} />}
    </FormDialog>
  )
}

export function FriendsView() {
  const { data: friends } = useSuspenseQuery(convexQuery(api.friends.list, {}))
  const { owed, owe } = sumBalances(friends.map((f) => f.balances))
  const settled = friends.filter((f) => Object.keys(f.balances).length === 0).length

  return (
    <>
      <PageHeader
        title="Friends"
        description="One-on-one expenses and settle-ups, outside any group."
        actions={<AddFriendButton />}
      />

      <div className="grid gap-6">
        <StatStrip>
          <Stat
            label="Friends owe you"
            icon={<ArrowDownLeft />}
            tone="positive"
            value={formatBalances(owed)}
          />
          <Stat
            label="You owe friends"
            icon={<ArrowUpRight />}
            tone="negative"
            value={formatBalances(owe)}
          />
          <Stat label="Friends" icon={<UsersRound />} value={friends.length || ''} />
          <Stat
            label="Settled up"
            icon={<CircleCheck />}
            value={friends.length ? `${settled} of ${friends.length}` : ''}
          />
        </StatStrip>

        <Panel>
          {friends.length === 0 ? (
            <Empty className="py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <UsersRound />
                </EmptyMedia>
                <EmptyTitle>No friends yet</EmptyTitle>
                <EmptyDescription>
                  Add someone to start tracking what you owe each other.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <AddFriendButton />
              </EmptyContent>
            </Empty>
          ) : (
            <PanelList>
              {friends.map((friend) => (
                <PanelRow key={friend.id} href={`/friends/${friend.id}`}>
                  <PersonAvatar name={friend.name} />
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium">{friend.name}</span>
                      <span className="hidden sm:inline-flex">
                        <FriendStatusBadge status={friend.status} />
                      </span>
                    </span>
                    {friend.email && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {friend.email}
                      </span>
                    )}
                  </span>
                  <BalanceText balances={friend.balances} className="text-right text-sm" />
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </PanelRow>
              ))}
            </PanelList>
          )}
        </Panel>
      </div>
    </>
  )
}

function AddFriendForm({ onAdded }: { onAdded: () => void }) {
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
      onAdded()
      router.push(`/friends/${created.value}`)
    }
  }

  return (
    <form noValidate onSubmit={onSubmit}>
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor="friend-name">Name</FieldLabel>
          <Input
            id="friend-name"
            value={name}
            maxLength={60}
            placeholder="Priya Shah"
            autoFocus
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
          <FieldDescription>They don’t need an account yet.</FieldDescription>
        </Field>
        {error && <FieldError>{error}</FieldError>}
        <Button type="submit" size="lg" disabled={pending}>
          {pending && <Spinner />}
          Add friend
        </Button>
      </FieldGroup>
    </form>
  )
}
