import Link from 'next/link'
import { Users } from 'lucide-react'

import { groupColor, labelTint } from '#/components/category'
import { formatMoney, formatWholeMoney, plural } from '@settlr/shared/format'
import type { GroupSummary } from '#/lib/types'
import { cn } from '#/lib/utils'

/** A group as a tile: colour mark, name, what was spent and where you stand. */
export function GroupTile({ group, className }: { group: GroupSummary; className?: string }) {
  return (
    <Link
      href={`/groups/${group.id}`}
      className={cn(
        'flex flex-col gap-3 rounded-xl border bg-card p-3.5 no-underline outline-none transition-[background-color,border-color] duration-140 hover:border-input hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          aria-hidden="true"
          className="grid size-8 place-items-center rounded-lg"
          style={labelTint(groupColor(group.id))}
        >
          <Users className="size-4" />
        </span>
        <span className="rounded-md border bg-muted px-1.5 py-px text-xs font-medium text-muted-foreground">
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
