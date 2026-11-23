import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { buttonVariants } from '#/components/ui/button'
import { formatMonth, shiftMonth } from '@settlr/shared/format'

/**
 * Previous/next month links for a page with a `?month=YYYY-MM` param (none
 * means this month, which the page resolved on the server as `thisMonth`).
 */
export function MonthNav({
  to,
  month,
  thisMonth,
}: {
  to: '/personal' | '/budget' | '/expenses'
  month: string
  thisMonth: string
}) {
  const link = (target: string, label: string, icon: React.ReactNode) => (
    <Link
      href={target === thisMonth ? to : `${to}?month=${target}`}
      aria-label={label}
      title={label}
      className={buttonVariants({ variant: 'ghost', size: 'icon-xs' })}
    >
      {icon}
    </Link>
  )
  return (
    // Sized like a button (Gr8r's 30px control) so it sits in a row of them.
    <nav
      className="flex h-8.5 items-center gap-0.5 rounded-lg border border-input bg-card px-0.5 sm:h-7.5"
      aria-label="Month"
    >
      {link(shiftMonth(month, -1), 'Previous month', <ChevronLeft />)}
      <span className="min-w-28 text-center text-ui font-medium tabular-nums">
        {formatMonth(month)}
      </span>
      {link(shiftMonth(month, 1), 'Next month', <ChevronRight />)}
    </nav>
  )
}
