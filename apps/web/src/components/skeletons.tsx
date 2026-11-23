import { Skeleton } from '#/components/ui/skeleton'
import { cn } from '#/lib/utils'

// Placeholders shaped like each page, shown while a route loads (see the
// `loading.tsx` files in src/app). They reuse the real layout classes so
// nothing jumps when the content arrives.

function Status({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-label="Loading">
      {children}
    </div>
  )
}

/** An empty card the size of the real one. */
function Panel({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-3.5', className)}>
      {children}
    </div>
  )
}

function HeaderSkeleton({
  back = false,
  media = false,
  actions = 0,
}: {
  back?: boolean
  media?: boolean
  actions?: number
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        {back && <Skeleton className="size-8.5 rounded-lg sm:hidden" />}
        {media && <Skeleton className="size-9 rounded-lg" />}
        <div className="grid gap-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-72 max-w-[60vw]" />
        </div>
      </div>
      {actions > 0 && (
        <div className="flex gap-1.5">
          {Array.from({ length: actions }, (_, i) => (
            <Skeleton key={i} className="h-8.5 w-28 rounded-lg sm:h-7.5" />
          ))}
        </div>
      )}
    </div>
  )
}

function StatRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="-mt-px -ml-px grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="flex flex-col gap-2 border-t border-l px-4 py-3.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-28" />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * A list: `filters` adds the expense lists' toolbar above the card; inside,
 * the header row and rows run edge to edge like the real table.
 */
export function TableSkeleton({ rows = 6, filters = false }: { rows?: number; filters?: boolean }) {
  return (
    <div className="grid gap-3">
      {filters && (
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-full rounded-lg sm:h-6.5 sm:w-56" />
          <Skeleton className="h-8 flex-1 rounded-lg sm:h-6.5 sm:w-32 sm:flex-none" />
          <Skeleton className="h-8 flex-1 rounded-lg sm:ml-auto sm:h-6.5 sm:w-28 sm:flex-none" />
        </div>
      )}
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex h-9 items-center border-b border-divider px-3.5">
          <Skeleton className="h-3 w-24" />
        </div>
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-divider px-3.5 py-2.25 last:border-b-0"
          >
            <Skeleton className="size-7 rounded-md" />
            <span className="grid flex-1 gap-1.5">
              <Skeleton className="h-3.5 w-2/5" />
              <Skeleton className="h-3 w-1/4" />
            </span>
            <Skeleton className="hidden h-3.5 w-20 md:block" />
            <Skeleton className="hidden h-3.5 w-20 md:block" />
            <Skeleton className="h-3.5 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}

function CardGridSkeleton({ count = 6, min = '15rem' }: { count?: number; min?: string }) {
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(auto-fill,minmax(${min},1fr))` }}
    >
      {Array.from({ length: count }, (_, i) => (
        <Panel key={i} className="gap-3.5 p-5">
          <Skeleton className="size-10 rounded-lg" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-28" />
        </Panel>
      ))}
    </div>
  )
}

function SideCardSkeleton({ lines = 4, className }: { lines?: number; className?: string }) {
  return (
    <Panel className={className}>
      <Skeleton className="h-5 w-32" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className="h-8.5 w-full rounded-lg sm:h-7.5" />
      ))}
    </Panel>
  )
}

function Split({ children, aside }: { children: React.ReactNode; aside: React.ReactNode }) {
  return (
    <div className="grid items-start gap-4 min-[1400px]:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="grid min-w-0 gap-4">{children}</div>
      <div className="grid gap-4">{aside}</div>
    </div>
  )
}

/** The router's default: a generic page. */
export function PageSkeleton() {
  return (
    <Status>
      <HeaderSkeleton />
      <div className="grid gap-4">
        <StatRowSkeleton />
        <TableSkeleton />
      </div>
    </Status>
  )
}

/** The dashboard: the stats strip, then lists beside the quick-split form. */
export function DashboardSkeleton() {
  return (
    <Status>
      <HeaderSkeleton actions={2} />
      <div className="grid gap-4">
        <StatRowSkeleton />
        {/* The dashboard's two columns (one on narrow screens). */}
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <div className="grid gap-4">
            <TableSkeleton rows={4} />
            <TableSkeleton rows={5} />
          </div>
          <div className="grid gap-4">
            <SideCardSkeleton lines={4} />
            <SideCardSkeleton lines={2} />
          </div>
        </div>
      </div>
    </Status>
  )
}

export function FriendsSkeleton() {
  return (
    <Status>
      <HeaderSkeleton />
      <Split aside={<SideCardSkeleton lines={3} />}>
        <StatRowSkeleton />
        <CardGridSkeleton min="16rem" />
      </Split>
    </Status>
  )
}

export function GroupsSkeleton() {
  return (
    <Status>
      <HeaderSkeleton actions={1} />
      <CardGridSkeleton />
    </Status>
  )
}

/**
 * Every expense page (a group, a friend, personal, all expenses): the header
 * with its icon and actions, the stats strip, then the list beside the side
 * cards.
 */
export function ExpensePageSkeleton({ back = false }: { back?: boolean }) {
  return (
    <Status>
      <HeaderSkeleton back={back} media actions={2} />
      <div className="grid gap-4">
        <StatRowSkeleton />
        <Split aside={<SideCardSkeleton lines={4} />}>
          <TableSkeleton filters />
        </Split>
      </div>
    </Status>
  )
}

/** Inside the group layout: the Insights tab. */
export function InsightsSkeleton() {
  return (
    <Status>
      <CardGridSkeleton count={3} min="22rem" />
    </Status>
  )
}

/** The monthly budget page: figures, the breakdown and the budget card. */
export function BudgetSkeleton() {
  return (
    <Status>
      <HeaderSkeleton actions={1} />
      <Split aside={<SideCardSkeleton lines={4} />}>
        <StatRowSkeleton />
        <TableSkeleton rows={3} />
      </Split>
    </Status>
  )
}

/** The assistant: its title, the starter actions and the message box. */
export function AssistantSkeleton() {
  return (
    <Status>
      <div className="flex min-h-[calc(100svh-10.625rem)] flex-col lg:min-h-[calc(100svh-7.75rem)]">
        <div className="flex min-h-10 items-center gap-2.5">
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="mx-auto grid w-full max-w-190 gap-2.5 py-17 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-17 rounded-lg" />
          ))}
        </div>
        <div className="flex-1" />
        <Skeleton className="mx-auto mb-4 h-15 w-full max-w-190 rounded-xl" />
      </div>
    </Status>
  )
}

/** The receipt viewer: a centered header and the file. */
export function ReceiptSkeleton() {
  return (
    <Status>
      <div className="mx-auto w-full max-w-4xl">
        <HeaderSkeleton back actions={1} />
        <Skeleton className="h-[60vh] w-full rounded-xl" />
      </div>
    </Status>
  )
}

/** A form page inside a group (add or edit an expense). */
export function FormSkeleton() {
  return (
    <Status>
      <Skeleton className="h-[34rem] w-full rounded-2xl" />
    </Status>
  )
}
