import { cn } from '#/lib/utils'

/** Title row at the top of a page, with optional breadcrumb and actions. */
export function PageHeader({
  title,
  description,
  eyebrow,
  media,
  actions,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  eyebrow?: React.ReactNode
  media?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-4">
        {media}
        <div className="grid min-w-0 gap-1">
          {eyebrow && (
            <div className="text-sm text-muted-foreground [&_a]:no-underline [&_a:hover]:text-foreground">
              {eyebrow}
            </div>
          )}
          <h1 className="m-0 truncate text-2xl font-bold tracking-tight sm:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** A two-column page body: main content and a sidebar (stacks on mobile). */
export function SplitLayout({
  children,
  aside,
}: {
  children: React.ReactNode
  aside: React.ReactNode
}) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="grid min-w-0 gap-4">{children}</div>
      <aside className="grid gap-4 lg:sticky lg:top-20">{aside}</aside>
    </div>
  )
}
