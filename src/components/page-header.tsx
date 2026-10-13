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
      variant="outline"
      size="icon-lg"
      className="shrink-0 border-border bg-card text-muted-foreground"
      aria-label={label}
      title={label}
      onClick={() => (canGoBack() ? router.back() : router.push(fallback))}
    >
      <ArrowLeft />
    </Button>
  )
}

/** Title row at the top of a page, with optional back button and actions. */
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
        'mb-4.5 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 pb-1.5',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3.5">
        {back && <BackButton {...back} />}
        {media}
        <div className="grid min-w-0 gap-1">
          {eyebrow && <p className="text-[0.8125rem] text-muted-foreground">{eyebrow}</p>}
          <h1 className="m-0 truncate text-[1.875rem] leading-[1.1] font-semibold tracking-[-0.04em]">
            {title}
          </h1>
          {description && (
            <p className="text-[0.8125rem] text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
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
    <div className="grid items-start gap-4.5 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="grid min-w-0 gap-4.5">{children}</div>
      <aside className="grid gap-4.5 xl:sticky xl:top-6">{aside}</aside>
    </div>
  )
}
