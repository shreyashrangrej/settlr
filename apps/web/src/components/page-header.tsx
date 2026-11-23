'use client'

import { ArrowLeft } from 'lucide-react'

import { useAppRouter } from '#/components/navigation-progress'
import { canGoBack } from '#/components/providers'
import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'

/**
 * Goes back to the previous page in this app, or to `fallback` when there
 * is none (the page was opened directly, e.g. from a bookmark).
 */
export function BackButton({
  fallback,
  label,
}: {
  /** Where to go when there's no previous page, e.g. '/friends'. */
  fallback: string
  label: string
}) {
  const router = useAppRouter()
  return (
    <Button
      variant="ghost"
      size="icon"
      className="-ml-1.5 shrink-0 sm:hidden"
      aria-label={label}
      title={label}
      onClick={() => (canGoBack() ? router.back() : router.push(fallback))}
    >
      <ArrowLeft />
    </Button>
  )
}

/**
 * Gr8r Studio's page header (`.ph`): a 23px semibold title with a muted line
 * under it, and the actions on the right. The back button only shows on
 * phones; wider screens have the breadcrumb in the top bar.
 */
export function PageHeader({
  title,
  eyebrow,
  description,
  back,
  media,
  actions,
  className,
}: {
  title: React.ReactNode
  /** A short line above the title, e.g. today's date. */
  eyebrow?: React.ReactNode
  description?: React.ReactNode
  back?: { fallback: string; label: string }
  media?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'mb-5 flex flex-wrap items-start justify-between gap-3',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {back && <BackButton {...back} />}
        {media}
        <div className="grid min-w-0">
          {eyebrow && <p className="mb-1 text-xs text-faint tabular-nums">{eyebrow}</p>}
          <h1 className="m-0 truncate text-xl leading-tight font-semibold tracking-[-0.022em] text-balance sm:text-2xl">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-1.5 max-sm:w-full">{actions}</div>
      )}
    </div>
  )
}

/**
 * A two-column page body: main content and a sidebar. They only sit side by
 * side from 1400px, where the column beside the app sidebar has room for
 * both; below that the sidebar stacks under the content. When the content
 * starts with an expense list's filter toolbar (one 26px row, then 12px),
 * the sidebar starts 38px down, level with the list's card rather than the
 * toolbar, so every expense page lines up the same way.
 */
export function SplitLayout({
  children,
  aside,
}: {
  children: React.ReactNode
  aside: React.ReactNode
}) {
  return (
    <div className="grid items-start gap-4 min-[1400px]:grid-cols-[minmax(0,1fr)_22rem] min-[1400px]:has-[[data-slot=expense-toolbar]]:[&>aside]:mt-9.5">
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">{children}</div>
      <aside className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 min-[1400px]:sticky min-[1400px]:top-4">
        {aside}
      </aside>
    </div>
  )
}
