'use client'

import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Repeat } from 'lucide-react'

import { CategoryIcon } from '#/components/category'
import { formatDate, formatMoney } from '@settlr/shared/format'
import { cn } from '#/lib/utils'
import { api } from '@settlr/backend/convex/_generated/api'

/**
 * The dashboard's "Upcoming bills": recurring expenses due in the next 30
 * days. Hidden until there's at least one recurring expense.
 */
export function UpcomingBills({ today, className }: { today: string; className?: string }) {
  const { data } = useQuery(convexQuery(api.recurring.upcoming, { today, days: 30 }))
  if (!data || data.length === 0) return null
  return (
    <section aria-labelledby="bills-h" className={cn('flex min-w-0 flex-col rounded-xl border bg-card', className)}>
      <div className="flex min-h-12 items-center gap-2 px-3.5 pt-3 pb-2.5">
        <h2 id="bills-h" className="m-0 text-sm font-semibold">
          Upcoming bills
        </h2>
        <Link href="/recurring" className="ml-auto text-xs text-muted-foreground">
          Manage
        </Link>
      </div>
      <ul className="m-0 grid list-none border-t border-divider p-0 pb-1">
        {data.slice(0, 5).map((bill) => (
          <li key={bill.id} className="flex items-center gap-2.5 px-3.5 py-2">
            <CategoryIcon category={bill.category} />
            <span className="grid min-w-0 flex-1">
              <span className="truncate text-sm font-medium">{bill.description}</span>
              <span className="flex items-center gap-1 text-xs text-faint">
                <Repeat className="size-3" aria-hidden="true" />
                {bill.nextDate <= today ? 'Due today' : formatDate(bill.nextDate)}
              </span>
            </span>
            <span className="text-sm font-medium tabular-nums">
              {formatMoney(bill.amountCents, bill.currency)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
