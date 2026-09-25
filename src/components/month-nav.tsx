import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { buttonVariants } from '#/components/ui/button'
import { formatMonth, shiftMonth } from '#/lib/format'

/**
 * Previous/next month links for a page with a `?month=YYYY-MM` param (none
 * means this month, which the loader resolved as `thisMonth`).
 */
export function MonthNav({
  to,
  month,
  thisMonth,
}: {
  to: '/personal' | '/budget'
  month: string
  thisMonth: string
}) {
  const link = (target: string, label: string, icon: React.ReactNode) => (
    <Link
      to={to}
      search={{ month: target === thisMonth ? '' : target }}
      aria-label={label}
      title={label}
      className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
    >
      {icon}
    </Link>
  )
  return (
    <nav className="flex items-center gap-1 rounded-lg border p-1" aria-label="Month">
      {link(shiftMonth(month, -1), 'Previous month', <ChevronLeft />)}
      <span className="min-w-36 text-center text-sm font-semibold">{formatMonth(month)}</span>
      {link(shiftMonth(month, 1), 'Next month', <ChevronRight />)}
    </nav>
  )
}
