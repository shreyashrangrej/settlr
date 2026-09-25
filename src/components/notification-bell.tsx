import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Bell } from 'lucide-react'

import { buttonVariants } from '#/components/ui/button'
import { cn } from '#/lib/utils'
import { api } from '#convex/_generated/api'

/**
 * Header bell with the number of friend requests and unread notifications.
 * The count loads in the browser (the server renders the bare bell), and
 * then updates live.
 */
export function NotificationBell() {
  const { data: count = 0 } = useQuery(convexQuery(api.notifications.unreadCount, {}))
  const label = count > 0 ? `Notifications (${count > 99 ? '99+' : count} new)` : 'Notifications'

  return (
    <Link
      to="/notifications"
      aria-label={label}
      title={label}
      className={cn(
        buttonVariants({ variant: 'ghost', size: 'icon' }),
        'relative data-[status=active]:bg-muted',
      )}
    >
      <Bell />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[0.625rem] leading-none font-bold text-white tabular-nums">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}
