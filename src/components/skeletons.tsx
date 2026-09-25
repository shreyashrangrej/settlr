import { Card, CardContent, CardHeader } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'

// Placeholders shaped like each page, shown while a route loads (see the
// \`pendingComponent\`s in src/routes). They reuse the real layout classes so
// nothing jumps when the content arrives.

function Status({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-label="Loading">
      {children}
    </div>
  )
}

function HeaderSkeleton({ back = false, actions = 0 }: { back?: boolean; actions?: number }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
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

function StatRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-4">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} size="sm">
          <CardHeader className="gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-32" />
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Card className="py-2">
      <CardContent className="grid gap-1 px-4">
        <Skeleton className="my-2 h-4 w-full max-w-md" />
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-t py-3">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="hidden h-4 w-24 md:block" />
            <Skeleton className="hidden h-4 w-24 md:block" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function CardGridSkeleton({ count = 6, min = '18rem' }: { count?: number; min?: string }) {
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(auto-fill,minmax(${min},1fr))` }}
    >
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} size="sm">
          <CardHeader className="gap-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-7 w-28" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function SideCardSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent className="grid gap-3">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </CardContent>
    </Card>
  )
}

function Split({ children, aside }: { children: React.ReactNode; aside: React.ReactNode }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
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

export function DashboardSkeleton() {
  return (
    <Status>
      <HeaderSkeleton actions={2} />
      <div className="grid gap-6">
        <StatRowSkeleton />
        <div className="grid items-start gap-4 lg:grid-cols-3">
          <SideCardSkeleton lines={3} />
          <SideCardSkeleton lines={3} />
          <SideCardSkeleton lines={3} />
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
        <Skeleton className="h-9 w-56" />
        <TableSkeleton />
      </Split>
    </Status>
  )
}

/** Inside the group layout: the Insights tab. */
export function InsightsSkeleton() {
  return (
    <Status>
      <div className="grid gap-4">
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
            <SideCardSkeleton lines={4} />
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
