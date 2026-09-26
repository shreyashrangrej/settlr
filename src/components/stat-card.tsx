import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
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
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        {icon && (
          <CardAction
            className={cn(
              'grid size-8 place-items-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4',
              tone === 'positive' && 'bg-positive/15 text-positive',
              tone === 'negative' && 'bg-destructive/15 text-destructive',
            )}
          >
            {icon}
          </CardAction>
        )}
        <CardTitle
          className={cn(
            'truncate text-2xl font-bold tabular-nums',
            empty && 'text-muted-foreground',
            !empty && tone === 'positive' && 'text-positive',
            !empty && tone === 'negative' && 'text-destructive',
          )}
        >
          {empty ? '—' : value}
        </CardTitle>
        {hint && <CardDescription className="truncate">{hint}</CardDescription>}
      </CardHeader>
    </Card>
  )
}
