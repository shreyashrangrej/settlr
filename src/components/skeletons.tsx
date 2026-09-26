import { Skeleton } from '#/components/ui/skeleton'

// Placeholders shaped like each page, shown while a route loads (see the
// `loading.tsx` files in src/app). They reuse the real layout classes (the
// stat strip, panels, the sidebar) so nothing jumps when the content arrives.

function Status({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-label="Loading">
      {children}
    </div>
  )
}

function HeaderSkeleton({ back = false, actions = 0 }: { back?: boolean; actions?: number }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <div className="flex items-center gap-3">
        {back && <Skeleton className="size-9 rounded-full" />}
        <div className="grid gap-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72 max-w-[60vw]" />
        </div>
      </div>
      {actions > 0 && (
        <div className="flex gap-2">
          {Array.from({ length: actions }, (_, i) => (
            <Skeleton key={i} className="h-9 w-32" />
          ))}
        </div>
      )}
    </div>
  )
}

/** The stat strip (see stats.tsx). */
function StripSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={`grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-4 ${className ?? ''}`}
    >
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="grid gap-2 bg-card px-4 py-3.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-32" />
        </div>
      ))}
    </div>
  )
}

function SectionHeading() {
  return (
    <div className="grid gap-1.5">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-4 w-56 max-w-full" />
    </div>
  )
}

/** A panel holding a table. */
function TablePanel({ rows = 6 }: { rows?: number }) {
return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex gap-4 border-b px-4 py-3">
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b px-4 py-3.5 last:border-0">
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="hidden h-4 w-24 md:block" />
          <Skeleton className="hidden h-4 w-24 md:block" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
      </div>
  )
}

/** A group's expenses table, inside the group layout. */
export function TableSkeleton() {
  return (
    <Status>
      <TablePanel />
    </Status>
  )
}

/** A panel holding a list of rows (friends, groups). */
function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y overflow-hidden rounded-xl border bg-card">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="size-9 rounded-full" />
          <div className="grid flex-1 gap-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  )
}

/** A sidebar section: a heading and a few lines, no box. */
function SideSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="grid gap-3">
      <SectionHeading />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  )
}

function Split({ children, aside }: { children: React.ReactNode; aside: React.ReactNode }) {
  return (
    <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="grid min-w-0 gap-6">{children}</div>
      <div className="grid content-start gap-8 lg:border-l lg:pl-8">{aside}</div>
    </div>
  )
}

/** The router's default: a generic page. */
export function PageSkeleton() {
  return (
    <Status>
      <HeaderSkeleton />
      <div className="grid gap-6">
        <StripSkeleton />
        <TablePanel />
      </div>
    </Status>
  )
}

export function DashboardSkeleton() {
  return (
    <Status>
      <HeaderSkeleton actions={2} />
      <StripSkeleton className="mb-8" />
      <Split
        aside={
          <>
            <SideSkeleton lines={2} />
            <SideSkeleton lines={4} />
          </>
        }
      >
        <SectionHeading />
        <ListSkeleton rows={4} />
        <SectionHeading />
        <ListSkeleton rows={3} />
      </Split>
    </Status>
  )
}

export function FriendsSkeleton() {
  return (
    <Status>
      <HeaderSkeleton actions={1} />
      <div className="grid gap-6">
        <StripSkeleton />
        <ListSkeleton rows={6} />
      </div>
    </Status>
  )
}

export function GroupsSkeleton() {
  return (
    <Status>
      <HeaderSkeleton actions={1} />
      <ListSkeleton rows={4} />
    </Status>
  )
}

/** A friend: back button, balance and actions, then the activity table. */
export function FriendSkeleton() {
  return (
    <Status>
      <HeaderSkeleton back actions={3} />
      <div className="grid gap-3">
        <SectionHeading />
        <TablePanel />
      </div>
    </Status>
  )
}

/** A group: back button, section tabs and a table, with the balances aside. */
export function DetailSkeleton() {
  return (
    <Status>
      <HeaderSkeleton back actions={2} />
      <Split
        aside={
          <>
            <SideSkeleton lines={4} />
            <SideSkeleton lines={2} />
          </>
        }
      >
        <Skeleton className="h-9 w-56" />
        <TablePanel />
      </Split>
    </Status>
  )
}

/** Inside the group layout: the Insights tab. */
export function InsightsSkeleton() {
  return (
    <Status>
      <div className="grid gap-6">
        <StripSkeleton />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    </Status>
  )
}

export function PersonalSkeleton() {
  return (
    <Status>
      <HeaderSkeleton actions={3} />
      <StripSkeleton className="mb-8" />
      <Split aside={<SideSkeleton lines={5} />}>
        <TablePanel />
      </Split>
    </Status>
  )
}

/** The monthly budget page: figures, the breakdown and the budget. */
export function BudgetSkeleton() {
  return (
    <Status>
      <HeaderSkeleton actions={1} />
      <StripSkeleton className="mb-8" />
      <Split aside={<SideSkeleton lines={3} />}>
        <SectionHeading />
        <TablePanel rows={3} />
      </Split>
    </Status>
  )
}

/** The assistant: the chat and its tips. */
export function AssistantSkeleton() {
  return (
    <Status>
      <HeaderSkeleton />
      <Split aside={<SideSkeleton lines={4} />}>
        <Skeleton className="h-[min(65vh,40rem)] w-full rounded-xl" />
      </Split>
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

/** A form page inside a group (add or edit an expense, edit the group). */
export function FormSkeleton() {
  return (
    <Status>
      <div className="grid max-w-3xl gap-6">
        <SectionHeading />
        <Skeleton className="h-9 w-full" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
        <Skeleton className="h-24 w-full" />
      </div>
    </Status>
  )
}
