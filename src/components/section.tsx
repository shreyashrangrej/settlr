'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { buttonVariants } from '#/components/ui/button'
import { cn } from '#/lib/utils'

// The page building blocks. Pages have one kind of surface, the `Panel`,
// for tables and lists of records. Everything else (headings, forms,
// breakdowns, sidebars) sits on the page background in `Section`s, so a
// page reads as a few clear areas rather than a stack of boxes.

/** A titled part of a page: a heading row, with optional actions, over its content. */
export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('grid min-w-0 content-start gap-3', className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div className="grid min-w-0 gap-0.5">
          <h2 className="m-0 text-base font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  )
}

/** A quiet "View all →" link for a section's actions. */
export function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        buttonVariants({ variant: 'ghost', size: 'sm' }),
        '-mr-2 text-muted-foreground no-underline',
      )}
    >
      {children}
      <ArrowRight />
    </Link>
  )
}

/**
 * A bordered surface for a table or a `PanelList`. Table rows get the same
 * side gutters as list rows.
 */
export function Panel({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'min-w-0 overflow-hidden rounded-xl border bg-card [&_tr>*:first-child]:pl-4 [&_tr>*:last-child]:pr-4',
        className,
      )}
      {...props}
    />
  )
}

/** Rows in a panel, split by hairlines. */
export function PanelList({ className, ...props }: React.ComponentProps<'ul'>) {
  return <ul className={cn('divide-y', className)} {...props} />
}

const rowClass = 'flex min-h-14 min-w-0 items-center gap-3 px-4 py-2.5'

/** One row of a `PanelList`; with `href`, the whole row is a link. */
export function PanelRow({
  href,
  className,
  children,
}: {
  href?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <li>
      {href ? (
        <Link
          href={href}
          className={cn(
            rowClass,
            'text-foreground no-underline outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/60',
            className,
          )}
        >
          {children}
        </Link>
      ) : (
        <div className={cn(rowClass, className)}>{children}</div>
      )}
    </li>
  )
}
