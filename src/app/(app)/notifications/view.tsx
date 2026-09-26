'use client'

import { useEffect, useState } from 'react'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Bell } from 'lucide-react'

import { NotificationRow, RequestRow } from '#/components/notifications'
import { PageHeader } from '#/components/page-header'
import { Panel, Section } from '#/components/section'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '#/components/ui/empty'
import { ItemGroup } from '#/components/ui/item'
import { api } from '#convex/_generated/api'

// Item rows as a hairline-split list inside a panel.
const rows = 'gap-0! divide-y [&>*]:rounded-none [&>*]:px-4'

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
    <div className="mx-auto grid w-full max-w-3xl gap-8">
      <PageHeader
        back={{ fallback: '/dashboard', label: 'Back' }}
        title="Notifications"
        description="Friend requests, and expenses others shared with you."
      />

      {data.requests.length > 0 && (
        <Section
          title="Friend requests"
          description="Accept to share a one-on-one ledger: you’ll both see the same expenses and payments."
        >
          <Panel>
            <ItemGroup className={rows}>
              {data.requests.map((request) => (
                <RequestRow key={request.id} request={request} />
              ))}
            </ItemGroup>
          </Panel>
        </Section>
      )}

      <Section title="Activity">
        <Panel>
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
            <ItemGroup className={rows}>
              {data.items.map((item) => (
                <NotificationRow key={item.id} item={item} isNew={fresh.has(item.id)} />
              ))}
            </ItemGroup>
          )}
        </Panel>
      </Section>
    </div>
  )
}
