import { useState } from 'react'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { UserPlus } from 'lucide-react'

import {
  Avatar,
  BalanceText,
  FormError,
  sumBalances,
  useAction,
} from '#/components/ledger'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
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
      <div className="page-header">
        <div>
          <h1>Friends</h1>
          <p className="muted">
            One-on-one expenses and settle-ups, outside any group.
          </p>
        </div>
      </div>

      <div className="group-layout">
        <section aria-label="Your friends" className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="card">
              <p className="muted">You are owed</p>
              <p className="card__stat positive">
                {formatBalances(owed) || '—'}
              </p>
            </div>
            <div className="card">
              <p className="muted">You owe</p>
              <p className="card__stat negative">{formatBalances(owe) || '—'}</p>
            </div>
          </div>

          {friends.length === 0 ? (
            <p className="empty">
              No friends yet. Add someone to start tracking what you owe each
              other.
            </p>
          ) : (
            <ul className="expense-list">
              {friends.map((friend) => (
                <li key={friend.id}>
                  <Link
                    to="/friends/$friendId"
                    params={{ friendId: friend.id }}
                    className="expense no-underline hover:bg-muted/40"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={friend.name} />
                      <div className="min-w-0">
                        <p className="expense__title truncate">{friend.name}</p>
                        {friend.email && (
                          <p className="muted truncate">{friend.email}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-right text-sm">
                      <BalanceText balances={friend.balances} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <AddFriend />
      </div>
    </>
  )
}

function AddFriend() {
  const createFriend = useConvexMutation(api.friends.create)
  const navigate = useNavigate()
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
      await navigate({
        to: '/friends/$friendId',
        params: { friendId: created.value },
      })
    }
  }

  return (
    <aside className="card" aria-labelledby="add-friend-heading">
      <form noValidate onSubmit={onSubmit} className="grid gap-4">
        <h2 id="add-friend-heading" className="m-0 flex items-center gap-2">
          <UserPlus className="size-4 text-primary" aria-hidden="true" />
          Add a friend
        </h2>
        <div className="grid gap-2">
          <Label htmlFor="friend-name">Name</Label>
          <Input
            id="friend-name"
            value={name}
            maxLength={60}
            placeholder="Priya Shah"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="friend-email">
            Email{' '}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="friend-email"
            type="email"
            value={email}
            maxLength={254}
            placeholder="priya@example.com"
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <FormError error={error} />
        <Button type="submit" disabled={pending}>
          {pending ? 'Adding…' : 'Add friend'}
        </Button>
      </form>
    </aside>
  )
}
