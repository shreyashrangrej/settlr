import Link from 'next/link'
import { Users } from 'lucide-react'

import { groupColor } from '#/components/category'
import { formatMoney, formatWholeMoney, plural } from '@settlr/shared/format'
import type { GroupSummary } from '#/lib/types'
import { cn } from '#/lib/utils'

/** A group as a tile: colour mark, name, what was spent and where you stand. */
export function GroupTile({ group, className }: { group: GroupSummary; className?: string }) {
  return (
    <Link
      href={`/groups/${group.id}`}
      className={cn(
        'flex flex-col gap-3 rounded-lg border bg-field p-3.5 no-underline outline-none transition-colors hover:border-input hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          aria-hidden="true"
          className="grid size-9 place-items-center rounded-lg text-on-fill"
          style={{ background: groupColor(group.id) }}
        >
          <Users className="size-4.5" />
        </span>
        <span className="rounded-sm bg-foreground/6 px-1.5 py-0.5 text-xs font-medium text-foreground dark:bg-foreground/8">
          {group.currency}
        </span>
      </div>
      <div className="grid gap-0.5">
        <span className="truncate text-sm font-medium">{group.name}</span>
        <span className="truncate text-xs text-muted-foreground">
          {plural(group.memberCount, 'person', 'people')}
          {!group.isOwner && ' · shared with you'}
        </span>
      </div>
      <span className="truncate text-xs text-muted-foreground">
        {formatWholeMoney(group.totalCents, group.currency)} spent ·{' '}
        {plural(group.expenseCount, 'expense')}
      </span>
      <span className="mt-auto text-xs text-muted-foreground">
        {group.myNetCents === 0 ? (
          'You’re square'
        ) : (
          <>
            {group.myNetCents > 0 ? 'You’re owed ' : 'You owe '}
            <span
              className={cn(
                'tabular-nums',
                group.myNetCents > 0 ? 'text-positive' : 'text-destructive',
              )}
            >
              {formatMoney(Math.abs(group.myNetCents), group.currency)}
            </span>
          </>
        )}
      </span>
    </Link>
  )
}
