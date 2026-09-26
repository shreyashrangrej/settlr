'use client'

import { useEffect, useState } from 'react'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Bell, UserPlus } from 'lucide-react'

import { NotificationRow, RequestRow } from '#/components/notifications'
import { PageHeader } from '#/components/page-header'
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
import { ItemGroup } from '#/components/ui/item'
import { api } from '#convex/_generated/api'

export function NotificationsView() {
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
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <PageHeader
        back={{ fallback: '/dashboard', label: 'Back' }}
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
