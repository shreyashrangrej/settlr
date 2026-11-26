'use client'

import { useState } from 'react'
import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import {
  CircleCheck,
  HandCoins,
  History,
  MessageSquare,
  Pencil,
  Plus,
  RotateCcw,
  Settings2,
  Trash2,
  UserPlus,
} from 'lucide-react'

import { IconTile } from '#/components/category'
import { useGroup } from '#/components/use-group'
import { Button } from '#/components/ui/button'
import { Card } from '#/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '#/components/ui/empty'
import { Spinner } from '#/components/ui/spinner'
import { formatMoney } from '@settlr/shared/format'
import { api } from '@settlr/backend/convex/_generated/api'

const ICONS = {
  expense_added: Plus,
  expense_updated: Pencil,
  expense_deleted: Trash2,
  expense_restored: RotateCcw,
  payment_added: HandCoins,
  payment_deleted: Trash2,
  payment_confirmed: CircleCheck,
  member_joined: UserPlus,
  comment: MessageSquare,
  group_updated: Settings2,
} as const

const VERBS = {
  expense_added: 'added',
  expense_updated: 'edited',
  expense_deleted: 'deleted',
  expense_restored: 'restored',
  payment_added: 'recorded',
  payment_deleted: '',
  payment_confirmed: '',
  member_joined: '',
  comment: 'commented',
  group_updated: '',
} as const

/** Everything that happened in the group, newest first. */
export function ActivityView() {
  const group = useGroup()
  const [limit, setLimit] = useState(50)
  const { data } = useQuery(
    convexQuery(api.groups.activity, { groupId: group?.id ?? '', limit }),
  )
  if (!group) return null
  if (!data) return <Spinner />
  if (data.length === 0) {
    return (
      <Empty className="rounded-xl border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <History />
          </EmptyMedia>
          <EmptyTitle>Nothing yet</EmptyTitle>
          <EmptyDescription>
            Changes from now on show up here: expenses, payments, comments and people joining.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  return (
    <Card className="p-0">
      <ul className="m-0 list-none p-0">
        {data.map((a) => {
          const Icon = ICONS[a.kind]
          const verb = VERBS[a.kind]
          return (
            <li key={a.id} className="flex items-start gap-3 border-t border-divider px-3.5 py-3 first:border-t-0">
              <IconTile className="text-muted-foreground">
                <Icon />
              </IconTile>
              <div className="grid min-w-0 flex-1 gap-0.5">
                <p className="m-0 text-sm">
                  <span className="font-medium">{a.actorName}</span> {verb}{' '}
                  {a.expenseId && a.kind !== 'expense_deleted' ? (
                    <Link href={`/groups/${group.id}?q=${encodeURIComponent(a.description)}`}>{a.description}</Link>
                  ) : (
                    a.description
                  )}
                </p>
                <span className="text-xs text-muted-foreground">
                  {new Date(a.at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              </div>
              {a.amountCents !== null && (
                <span className="text-sm font-medium tabular-nums">
                  {formatMoney(a.amountCents, group.currency)}
                </span>
              )}
            </li>
          )
        })}
      </ul>
      {data.length >= limit && (
        <div className="border-t border-divider p-3 text-center">
          <Button variant="ghost" size="sm" onClick={() => setLimit((n) => n + 50)}>
            Show more
          </Button>
        </div>
      )}
    </Card>
  )
}
