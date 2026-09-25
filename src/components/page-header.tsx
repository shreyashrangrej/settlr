import { useCanGoBack, useRouter, type NavigateOptions } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'

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
  fallback: NavigateOptions
  label: string
}) {
  const router = useRouter()
  const canGoBack = useCanGoBack()
  return (
    <Button
      variant="outline"
      size="icon-lg"
      className="shrink-0 rounded-full"
      aria-label={label}
      title={label}
      onClick={() => (canGoBack ? router.history.back() : router.navigate(fallback))}
    >
      <ArrowLeft />
    </Button>
  )
}

/** Title row at the top of a page, with optional back button and actions. */
export function PageHeader({
  title,
  description,
  back,
  media,
  actions,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  back?: { fallback: NavigateOptions; label: string }
  media?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {back && <BackButton {...back} />}
        {media}
        <div className="grid min-w-0 gap-0.5">
          <h1 className="m-0 truncate text-2xl font-bold tracking-tight">
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
      <aside className="grid gap-4 lg:sticky lg:top-18">{aside}</aside>
    </div>
  )
}
