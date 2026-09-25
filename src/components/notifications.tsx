'use client'

import { useConvexMutation } from '@convex-dev/react-query'
import Link from 'next/link'
import type { FunctionReturnType } from 'convex/server'
import { HandCoins, Pencil, Receipt, UserCheck, Users } from 'lucide-react'

import { PersonAvatar, useAction } from '#/components/ledger'
import { useAppRouter } from '#/components/navigation-progress'
import { Button } from '#/components/ui/button'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '#/components/ui/item'
import { Spinner } from '#/components/ui/spinner'
import { formatMoney } from '#/lib/format'
import type { Currency } from '#/lib/schemas'
import { cn } from '#/lib/utils'
import { api } from '#convex/_generated/api'

// Friend requests and notifications, shared by the header dropdown and the
// notifications page. Both render only in the browser (the dropdown once
// opened, the page is `ssr: 'data-only'`), so relative times are safe.

export type Notifications = FunctionReturnType<typeof api.notifications.list>
export type Notification = Notifications['items'][number]
export type FriendRequest = Notifications['requests'][number]

/** A pending friend request with Accept and Decline. */
export function RequestRow({
  request,
  size,
  onDone,
}: {
  request: FriendRequest
  size?: 'default' | 'sm'
  /** Called after accepting (which opens the friend) or declining. */
  onDone?: () => void
}) {
  const router = useAppRouter()
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
    <Item size={size}>
      <ItemMedia>
        <PersonAvatar name={request.fromName} size={size === 'sm' ? 'sm' : 'default'} />
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
          size={size === 'sm' ? 'sm' : 'default'}
          disabled={busy}
          onClick={async () => {
            if (await decline.run({ requestId: request.id })) onDone?.()
          }}
        >
          {decline.pending && <Spinner />}
          Decline
        </Button>
        <Button
          size={size === 'sm' ? 'sm' : 'default'}
          disabled={busy}
          onClick={async () => {
            const linked = await accept.run({ requestId: request.id })
            if (!linked) return
            onDone?.()
            router.push(`/friends/${linked.value}`)
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
  const friendLink = item.friendId ? `/friends/${item.friendId}` : null
  const groupLink = item.groupId ? `/groups/${item.groupId}` : null

  switch (item.kind) {
    case 'friend_expense':
      return {
        icon: <Receipt />,
        title: `${item.actorName} added “${item.description ?? 'an expense'}”`,
        effect,
        link: friendLink,
      }
    case 'friend_payment':
      return {
        icon: <HandCoins />,
        title:
          (item.amountCents ?? 0) < 0
            ? `${item.actorName} paid you ${money(item.amountCents ?? 0)}`
            : `${item.actorName} recorded that you paid them ${money(item.amountCents ?? 0)}`,
        effect: item.description ? { text: item.description, tone: null } : null,
        link: friendLink,
      }
    case 'friend_entry_updated':
      return {
        icon: <Pencil />,
        title: `${item.actorName} edited “${item.description ?? 'a payment'}”`,
        effect,
        link: friendLink,
      }
    case 'group_expense':
      return {
        icon: <Receipt />,
        title: `${item.actorName} added “${item.description ?? 'an expense'}” in ${item.groupName ?? 'a group'}`,
        effect,
        link: groupLink,
      }
    case 'group_expense_updated':
      return {
        icon: <Pencil />,
        title: `${item.actorName} edited “${item.description ?? 'an expense'}” in ${item.groupName ?? 'a group'}`,
        effect,
        link: groupLink,
      }
    case 'group_added':
      return {
        icon: <Users />,
        title: `${item.actorName} added you to ${item.groupName ?? 'a group'}`,
        effect: null,
        link: groupLink,
      }
    case 'request_accepted':
      return {
        icon: <UserCheck />,
        title: `${item.actorName} accepted your friend request`,
        effect: { text: 'Your ledgers are now shared', tone: null },
        link: friendLink,
      }
  }
}

/** One notification, linking to the friend or group it's about. */
export function NotificationRow({
  item,
  isNew,
  size,
  onNavigate,
}: {
  item: Notification
  isNew: boolean
  size?: 'default' | 'sm'
  /** Called when the row is followed (the dropdown closes itself). */
  onNavigate?: () => void
}) {
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
        <ItemTitle className={cn('line-clamp-2', isNew && 'font-semibold')}>{title}</ItemTitle>
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
  if (!link) return <Item size={size}>{body}</Item>
  return (
    <Item
      size={size}
      render={<Link href={link} onClick={onNavigate} />}
    >
      {body}
    </Item>
  )
}

/** "5 minutes ago", in the viewer's locale. Browser only. */
export function relativeTime(epochMs: number) {
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
