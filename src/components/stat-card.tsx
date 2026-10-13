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
        'grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-4.5',
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
      className="flex min-w-0 flex-col gap-2.5 rounded-3xl border bg-card p-5"
    >
      <span className="flex items-center gap-2 font-medium text-muted-foreground">
        {icon && (
          <span
            className={cn(
              'grid size-7 shrink-0 place-items-center rounded-lg bg-tile text-muted-foreground [&_svg]:size-[15px]',
              tone === 'positive' && 'bg-positive/14 text-positive',
              tone === 'negative' && 'bg-destructive/14 text-destructive',
            )}
          >
            {icon}
          </span>
        )}
        <span className="truncate">{label}</span>
      </span>
      <p
        className={cn(
          'truncate font-mono text-[1.625rem] leading-tight font-medium tracking-[-0.03em] tabular-nums',
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
