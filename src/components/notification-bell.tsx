import { useState } from 'react'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Bell } from 'lucide-react'

import { NotificationRow, RequestRow } from '#/components/notifications'
import { Button, buttonVariants } from '#/components/ui/button'
import { ItemGroup } from '#/components/ui/item'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '#/components/ui/popover'
import { Separator } from '#/components/ui/separator'
import { Spinner } from '#/components/ui/spinner'
import { cn } from '#/lib/utils'
import { api } from '#convex/_generated/api'

// How many of each the dropdown shows; "More" opens the full page.
const PREVIEW = 5

/**
 * Header bell with the number of friend requests and unread notifications.
 * It opens a dropdown with the latest ones; "More" goes to the full page.
 * The data loads in the browser (the server renders the bare bell) and then
 * updates live.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const { data: count = 0 } = useQuery(convexQuery(api.notifications.unreadCount, {}))
  const { data } = useQuery(convexQuery(api.notifications.list, { limit: PREVIEW }))
  const markAllRead = useConvexMutation(api.notifications.markAllRead)
  // What was unread when the dropdown opened stays highlighted while it's
  // open, even though opening it marks everything read.
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set())
  const label = count > 0 ? `Notifications (${count > 99 ? '99+' : count} new)` : 'Notifications'
  const close = () => setOpen(false)

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next && data) {
          const unread = data.items.filter((n) => !n.read)
          setFresh(new Set(unread.map((n) => n.id)))
          if (count > 0) void markAllRead({})
        }
        setOpen(next)
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={label}
            title={label}
            className="relative data-popup-open:bg-muted"
          />
        }
      >
        <Bell />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[0.625rem] leading-none font-bold text-white tabular-nums">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 max-w-[calc(100vw-1.5rem)] gap-0 p-0">
        <PopoverHeader className="px-4 pt-3 pb-2">
          <PopoverTitle className="text-base font-semibold">Notifications</PopoverTitle>
          <PopoverDescription className="text-xs">
            Friend requests, and expenses others shared with you.
          </PopoverDescription>
        </PopoverHeader>
        <Separator />
        <div className="max-h-[min(28rem,70vh)] overflow-y-auto p-1.5">
          {!data ? (
            <div className="grid place-items-center py-8">
              <Spinner />
            </div>
          ) : data.requests.length === 0 && data.items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              You’re all caught up.
            </p>
          ) : (
            <ItemGroup className="gap-1">
              {data.requests.map((request) => (
                <RequestRow key={request.id} request={request} size="sm" onDone={close} />
              ))}
              {data.items.map((item) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  isNew={fresh.has(item.id)}
                  size="sm"
                  onNavigate={close}
                />
              ))}
            </ItemGroup>
          )}
        </div>
        <Separator />
        <div className="p-1.5">
          <Link
            to="/notifications"
            onClick={close}
            className={cn(
              buttonVariants({ variant: 'ghost' }),
              'w-full justify-center no-underline',
            )}
          >
            More
            <ArrowRight />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
