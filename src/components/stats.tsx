import { cn } from '#/lib/utils'

/**
 * A page's summary figures in one strip, split by hairlines: two to a row,
 * all four in one row on wide screens. Give it exactly four `Stat`s so the
 * rows are always full.
 */
export function StatStrip({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        // The gap shows the border colour between the cells.
        'grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-4',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function Stat({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  icon?: React.ReactNode
  tone?: 'positive' | 'negative'
}) {
  const empty = value === '' || value === null || value === undefined
  return (
    <div className="grid min-w-0 content-start gap-1 bg-card px-4 py-3.5">
      <p
        className={cn(
          'flex items-center gap-1.5 text-sm text-muted-foreground [&_svg]:size-3.5 [&_svg]:shrink-0',
          tone === 'positive' && '[&_svg]:text-positive',
          tone === 'negative' && '[&_svg]:text-destructive',
        )}
      >
        {icon}
        <span className="truncate">{label}</span>
      </p>
      <p
        className={cn(
          'text-xl font-bold tracking-tight break-words tabular-nums sm:text-2xl',
          empty && 'text-muted-foreground',
          !empty && tone === 'positive' && 'text-positive',
          !empty && tone === 'negative' && 'text-destructive',
        )}
      >
        {empty ? '—' : value}
      </p>
      {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
