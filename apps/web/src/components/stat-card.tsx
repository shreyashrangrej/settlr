import { cn } from '#/lib/utils'

/**
 * Gr8r Studio's stats strip (`.stats`): one bordered box whose figures sit
 * side by side with hairlines between them, wrapping onto more rows on
 * narrow screens. Each cell draws its own left and top hairline, and the
 * grid is pulled 1px up and left under the box's clipped edge, so only the
 * lines between cells show however the row wraps.
 */
export function StatGrid({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('overflow-hidden rounded-xl border bg-card', className)}>
      <div className="-mt-px -ml-px grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]">
        {children}
      </div>
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
      className="flex min-w-0 flex-col gap-1.5 border-t border-l px-4 py-3.5"
    >
      <span className="flex items-center gap-1.5 text-ui text-muted-foreground [&_svg]:size-3.5 [&_svg]:shrink-0">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <p
        className={cn(
          'truncate text-[1.375rem] leading-[1.1] font-semibold tracking-[-0.02em] tabular-nums',
          empty && 'text-faint',
          !empty && tone === 'positive' && 'text-positive',
          !empty && tone === 'negative' && 'text-destructive',
        )}
      >
        {empty ? '—' : value}
      </p>
      {hint && <p className="truncate text-xs text-faint">{hint}</p>}
    </section>
  )
}
