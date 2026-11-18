import { cn } from '#/lib/utils'

/**
 * A row of compact figures that shares the row between its cards (auto-fit)
 * and wraps onto more rows on narrow screens.
 */
export function StatGrid({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-4',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function StatCard({
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
    <section
      aria-label={label}
      className="flex min-w-0 flex-col gap-2 rounded-xl border bg-card px-4 py-3.5 shadow-xs/5"
    >
      <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {icon && (
          <span
            className={cn(
              'grid size-6 shrink-0 place-items-center rounded-md bg-tile text-muted-foreground [&_svg]:size-3.5',
              tone === 'positive' && 'bg-positive/10 text-positive dark:bg-positive/16',
              tone === 'negative' && 'bg-destructive/8 text-destructive dark:bg-destructive/16',
            )}
          >
            {icon}
          </span>
        )}
        <span className="truncate">{label}</span>
      </span>
      <p
        className={cn(
          'truncate text-2xl leading-tight font-semibold tracking-[-0.02em] tabular-nums',
          empty && 'text-muted-foreground',
          !empty && tone === 'positive' && 'text-positive',
          !empty && tone === 'negative' && 'text-destructive',
        )}
      >
        {empty ? '—' : value}
      </p>
      {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
    </section>
  )
}
