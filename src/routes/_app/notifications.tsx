import { useEffect, useState } from 'react'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import type { FunctionReturnType } from 'convex/server'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  Bell,
  HandCoins,
  Receipt,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react'

import { PersonAvatar, useAction } from '#/components/ledger'
import { PageHeader } from '#/components/page-header'
import { PageSkeleton } from '#/components/skeletons'
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
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '#/components/ui/item'
import { Spinner } from '#/components/ui/spinner'
import { formatMoney } from '#/lib/format'
import type { Currency } from '#/lib/schemas'
import { cn } from '#/lib/utils'
import { api } from '#convex/_generated/api'

type Notifications = FunctionReturnType<typeof api.notifications.list>
type Notification = Notifications['items'][number]
type Request = Notifications['requests'][number]

// SSR: data-only. The list is prefetched on the server, but times are shown
// relative to the viewer's clock ("5 minutes ago"), so it renders in the
// browser.
export const Route = createFileRoute('/_app/notifications')({
  ssr: 'data-only',
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(convexQuery(api.notifications.list, {})),
  head: () => ({ meta: [{ title: 'Notifications · Settlr' }] }),
  pendingComponent: PageSkeleton,
  component: NotificationsPage,
})

function NotificationsPage() {
  const { data } = useSuspenseQuery(convexQuery(api.notifications.list, {}))
  const markAllRead = useConvexMutation(api.notifications.markAllRead)
  const unread = data.items.filter((n) => !n.read).length
  // Opening the page counts as reading them, but what was new when you
  // arrived stays highlighted until you leave.
  const [fresh] = useState(
    () => new Set(data.items.filter((n) => !n.read).map((n) => n.id)),
  )

  useEffect(() => {
    if (unread > 0) void markAllRead({})
  }, [unread, markAllRead])

  return (
    <div className="grid max-w-3xl gap-4">
      <PageHeader
        back={{ fallback: { to: '/dashboard' }, label: 'Back' }}
        title="Notifications"
        description="Friend requests, and expenses others shared with you."
      />

      {data.requests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="size-4 text-primary" aria-hidden="true" />
              Friend requests
            </CardTitle>
            <CardDescription>
              Accept to share a one-on-one ledger: you’ll both see the same
              expenses and payments.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2">
            <ItemGroup>
              {data.requests.map((request) => (
                <RequestRow key={request.id} request={request} />
              ))}
            </ItemGroup>
          </CardContent>
        </Card>
      )}

      <Card className="py-2">
        <CardContent className="px-2">
          {data.items.length === 0 ? (
            <Empty className="py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Bell />
                </EmptyMedia>
                <EmptyTitle>You’re all caught up</EmptyTitle>
                <EmptyDescription>
                  When friends split an expense with you, it shows up here.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ItemGroup>
              {data.items.map((item) => (
                <NotificationRow key={item.id} item={item} isNew={fresh.has(item.id)} />
              ))}
            </ItemGroup>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function RequestRow({ request }: { request: Request }) {
  const navigate = useNavigate()
  const accept = useAction(useConvexMutation(api.notifications.acceptRequest), {
    success: `You and ${request.fromName} are now connected`,
    toastErrors: true,
  })
  const decline = useAction(useConvexMutation(api.notifications.declineRequest), {
    success: 'Request declined',
    toastErrors: true,
  })
  const busy = accept.pending || decline.pending

  return (
    <Item>
      <ItemMedia>
        <PersonAvatar name={request.fromName} />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{request.fromName}</ItemTitle>
        <ItemDescription>
          {request.fromEmail} · {relativeTime(request.sentAt)}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => void decline.run({ requestId: request.id })}
        >
          {decline.pending && <Spinner />}
          Decline
        </Button>
        <Button
          disabled={busy}
          onClick={async () => {
            const linked = await accept.run({ requestId: request.id })
            if (linked) {
              await navigate({
                to: '/friends/$friendId',
                params: { friendId: linked.value },
              })
            }
          }}
        >
          {accept.pending && <Spinner />}
          Accept
        </Button>
      </ItemActions>
    </Item>
  )
}

// What a notification says and where it leads.
function describe(item: Notification) {
  const money = (cents: number) =>
    item.currency ? formatMoney(Math.abs(cents), item.currency as Currency) : ''
  const effect =
    item.amountCents === undefined || item.amountCents === 0
      ? null
      : item.amountCents > 0
        ? { text: `You’re owed ${money(item.amountCents)}`, tone: 'positive' as const }
        : { text: `You owe ${money(item.amountCents)}`, tone: 'negative' as const }

  switch (item.kind) {
    case 'friend_expense':
      return {
        icon: <Receipt />,
        title: `${item.actorName} added “${item.description ?? 'an expense'}”`,
        effect,
        link: item.friendId ? { to: '/friends/$friendId', params: { friendId: item.friendId } } : null,
      }
    case 'friend_payment':
      return {
        icon: <HandCoins />,
        title:
          (item.amountCents ?? 0) < 0
            ? `${item.actorName} paid you ${money(item.amountCents ?? 0)}`
            : `${item.actorName} recorded that you paid them ${money(item.amountCents ?? 0)}`,
        effect: item.description ? { text: item.description, tone: null } : null,
        link: item.friendId ? { to: '/friends/$friendId', params: { friendId: item.friendId } } : null,
      }
    case 'group_expense':
      return {
        icon: <Receipt />,
        title: `${item.actorName} added “${item.description ?? 'an expense'}” in ${item.groupName ?? 'a group'}`,
        effect,
        link: item.groupId ? { to: '/groups/$groupId', params: { groupId: item.groupId } } : null,
      }
    case 'group_added':
      return {
        icon: <Users />,
        title: `${item.actorName} added you to ${item.groupName ?? 'a group'}`,
        effect: null,
        link: item.groupId ? { to: '/groups/$groupId', params: { groupId: item.groupId } } : null,
      }
    case 'request_accepted':
      return {
        icon: <UserCheck />,
        title: `${item.actorName} accepted your friend request`,
        effect: { text: 'Your ledgers are now shared', tone: null },
        link: item.friendId ? { to: '/friends/$friendId', params: { friendId: item.friendId } } : null,
      }
  }
}

function NotificationRow({ item, isNew }: { item: Notification; isNew: boolean }) {
  const { icon, title, effect, link } = describe(item)
  const body = (
    <>
      <ItemMedia
        variant="icon"
        className={cn(
          'grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground',
          isNew && 'bg-primary/15 text-primary',
        )}
      >
        {icon}
      </ItemMedia>
      <ItemContent>
        <ItemTitle className={cn(isNew && 'font-semibold')}>{title}</ItemTitle>
        <ItemDescription>
          {relativeTime(item.createdAt)}
          {effect && (
            <>
              {' · '}
              <span
                className={cn(
                  effect.tone === 'positive' && 'text-positive',
                  effect.tone === 'negative' && 'text-destructive',
                )}
              >
                {effect.text}
              </span>
            </>
          )}
        </ItemDescription>
      </ItemContent>
      {isNew && (
        <ItemActions>
          <span className="size-2 rounded-full bg-primary" aria-label="New" />
        </ItemActions>
      )}
    </>
  )
  if (!link) return <Item>{body}</Item>
  return (
    // The link's params match its route; the union confuses Link's types.
    <Item render={<Link {...(link as { to: '/friends/$friendId'; params: { friendId: string } })} />}>
      {body}
    </Item>
  )
}

// This page renders only in the browser, so the viewer's clock and locale
// are safe to use.
function relativeTime(epochMs: number) {
  const seconds = (epochMs - Date.now()) / 1000
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ]
  const locale = new Intl.NumberFormat().resolvedOptions().locale
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit)
  }
  return 'just now'
}
