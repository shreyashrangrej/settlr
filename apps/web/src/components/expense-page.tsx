import { SplitLayout } from '#/components/page-header'
import { cn } from '#/lib/utils'

/**
 * The frame every expense page shares (a group, a friend, personal, all
 * expenses), after Gr8r Studio's list pages: the `PageHeader` the page
 * renders above this, then the stats strip across the full width, then the
 * list (the filter toolbar and table) beside the side cards. `children` is
 * the list column; `stats` a `StatGrid`; `aside` the side cards.
 */
export function ExpensePage({
  stats,
  aside,
  children,
}: {
  stats: React.ReactNode
  aside: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-4">
      {stats}
      <SplitLayout aside={aside}>{children}</SplitLayout>
    </div>
  )
}

/**
 * The page's icon beside its title: a 36px tile, tinted by `style` (e.g.
 * `labelTint(...)`) or in the accent by default.
 */
export function PageIcon({
  children,
  style,
  className,
}: {
  children: React.ReactNode
  style?: React.CSSProperties
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-9 shrink-0 place-items-center rounded-lg [&_svg]:size-4.5',
        !style && 'bg-primary-soft text-primary',
        className,
      )}
      style={style}
    >
      {children}
    </span>
  )
}
