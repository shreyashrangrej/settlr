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
    <div className={cn('flex min-w-0 flex-col gap-3 rounded-3xl border bg-card p-5.5', className)}>
      {children}
    </div>
  )
}

function HeaderSkeleton({ back = false, actions = 0 }: { back?: boolean; actions?: number }) {
  return (
    <div className="mb-4.5 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 pb-1.5">
      <div className="flex items-center gap-3.5">
        {back && <Skeleton className="size-11 rounded-xl" />}
        <div className="grid gap-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72 max-w-[60vw]" />
        </div>
      </div>
      {actions > 0 && (
        <div className="flex gap-2.5">
          {Array.from({ length: actions }, (_, i) => (
            <Skeleton key={i} className="h-11 w-36 rounded-xl" />
          ))}
        </div>
      )}
    </div>
  )
}

function StatRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-4.5">
      {Array.from({ length: count }, (_, i) => (
        <Panel key={i} className="gap-2.5 p-5">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-8 w-32" />
        </Panel>
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Panel className="gap-0">
      <Skeleton className="mb-3 h-4 w-full max-w-md" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-t border-divider py-3.5">
          <Skeleton className="size-8.5 rounded-[10px]" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="hidden h-4 w-24 md:block" />
          <Skeleton className="hidden h-4 w-24 md:block" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </Panel>
  )
}

function CardGridSkeleton({ count = 6, min = '15rem' }: { count?: number; min?: string }) {
  return (
    <div
      className="grid gap-4.5"
      style={{ gridTemplateColumns: `repeat(auto-fill,minmax(${min},1fr))` }}
    >
      {Array.from({ length: count }, (_, i) => (
        <Panel key={i} className="gap-3.5 p-5">
          <Skeleton className="size-10 rounded-xl" />
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
        <Skeleton key={i} className="h-11 w-full rounded-xl" />
      ))}
    </Panel>
  )
}

function Split({ children, aside }: { children: React.ReactNode; aside: React.ReactNode }) {
  return (
    <div className="grid items-start gap-4.5 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="grid min-w-0 gap-4.5">{children}</div>
      <div className="grid gap-4.5">{aside}</div>
    </div>
  )
}

/** The router's default: a generic page. */
export function PageSkeleton() {
  return (
    <Status>
      <HeaderSkeleton />
      <div className="grid gap-4.5">
        <StatRowSkeleton />
        <TableSkeleton />
      </div>
    </Status>
  )
}

/** The dashboard's rows: hero and figures, balances, groups, recent spending. */
export function DashboardSkeleton() {
  return (
    <Status>
      <HeaderSkeleton actions={1} />
      <div className="grid gap-4.5">
        <div className="flex flex-wrap items-stretch gap-4.5">
          <Panel className="flex-[2_1_380px] gap-4.5 p-6">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-14 w-64 max-w-full" />
            <Skeleton className="mt-auto h-2.5 w-full rounded-full" />
            <div className="grid grid-cols-2 gap-2.5">
              <Skeleton className="h-16 rounded-[14px]" />
              <Skeleton className="h-16 rounded-[14px]" />
            </div>
          </Panel>
          <div className="flex flex-[1_1_220px] flex-col gap-4.5">
            <SideCardSkeleton lines={1} className="flex-1 p-5" />
            <SideCardSkeleton lines={1} className="flex-1 p-5" />
          </div>
          <SideCardSkeleton lines={4} className="flex-[1_1_280px] p-5" />
        </div>
        <div className="flex flex-wrap items-stretch gap-4.5">
          <div className="flex-[3_1_480px]">
            <TableSkeleton rows={4} />
          </div>
          <SideCardSkeleton lines={3} className="flex-[2_1_320px] p-5" />
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

/** A detail page: back button, a table and a sidebar (friend, group). */
export function DetailSkeleton() {
  return (
    <Status>
      <HeaderSkeleton back actions={1} />
      <Split aside={<SideCardSkeleton lines={5} />}>
        <Skeleton className="h-10.5 w-56 rounded-xl" />
        <TableSkeleton />
      </Split>
    </Status>
  )
}

/** Inside the group layout: the Insights tab. */
export function InsightsSkeleton() {
  return (
    <Status>
      <div className="grid gap-4.5">
        <StatRowSkeleton />
        <CardGridSkeleton count={3} min="22rem" />
      </div>
    </Status>
  )
}

export function PersonalSkeleton() {
  return (
    <Status>
      <HeaderSkeleton actions={1} />
      <Split
        aside={
          <>
            <SideCardSkeleton lines={5} />
            <SideCardSkeleton lines={2} />
          </>
        }
      >
        <StatRowSkeleton />
        <TableSkeleton />
      </Split>
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

/** The assistant: its header, the conversation and the changes panel. */
export function AssistantSkeleton() {
  return (
    <Status>
      <div className="grid items-start gap-x-8 gap-y-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-h-[calc(100svh-13rem)] flex-col lg:min-h-[calc(100svh-4.5rem)]">
          <div className="flex items-center gap-3 border-b border-divider pb-4">
            <Skeleton className="size-10 rounded-xl" />
            <div className="grid gap-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3.5 w-64 max-w-[50vw]" />
            </div>
          </div>
          <div className="flex-1" />
          <Skeleton className="mx-auto mb-4.5 h-18 w-full max-w-190 rounded-[20px]" />
        </div>
        <SideCardSkeleton lines={4} />
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
        <Skeleton className="h-[60vh] w-full rounded-3xl" />
      </div>
    </Status>
  )
}

/** A form page inside a group (add or edit an expense). */
export function FormSkeleton() {
  return (
    <Status>
      <Skeleton className="h-[34rem] w-full rounded-[28px]" />
    </Status>
  )
}
