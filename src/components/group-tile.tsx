import Link from 'next/link'
import { Users } from 'lucide-react'

import { groupColor } from '#/components/category'
import { formatMoney, plural } from '#/lib/format'
import type { GroupSummary } from '#/lib/types'
import { cn } from '#/lib/utils'

/** A group as a tile: colour mark, name, what was spent and where you stand. */
export function GroupTile({ group, className }: { group: GroupSummary; className?: string }) {
  return (
    <Link
      href={`/groups/${group.id}`}
      className={cn(
        'flex flex-col gap-3.5 rounded-2xl border border-input/70 bg-tile p-4 no-underline outline-none hover:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring/50',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          aria-hidden="true"
          className="grid size-10 place-items-center rounded-xl text-on-fill"
          style={{ background: groupColor(group.id) }}
        >
          <Users className="size-5" />
        </span>
        <span className="rounded-full bg-segment px-2 py-0.5 text-xs font-medium text-soft">
          {group.currency}
        </span>
      </div>
      <div className="grid gap-0.5">
        <span className="truncate text-[0.9375rem] font-semibold">{group.name}</span>
        <span className="truncate text-xs text-muted-foreground">
          {plural(group.memberCount, 'person', 'people')}
          {!group.isOwner && ' · shared with you'}
        </span>
      </div>
      <div className="flex justify-between gap-2 text-xs text-muted-foreground">
        <span>{formatMoney(group.totalCents, group.currency)} spent</span>
        <span>{plural(group.expenseCount, 'expense')}</span>
      </div>
      <span className="mt-auto text-[0.8125rem] text-muted-foreground">
        {group.myNetCents === 0 ? (
          'You’re square'
        ) : (
          <>
            {group.myNetCents > 0 ? 'You’re owed ' : 'You owe '}
            <span
              className={cn(
                'font-mono tabular-nums',
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
