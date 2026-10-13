import { cn } from '#/lib/utils'

/** The Settlr mark: a split sign on the accent colour. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('size-8 shrink-0', className)}>
      <rect width="32" height="32" rx="10" className="fill-primary" />
      <path
        d="M10 22 22 10"
        strokeWidth="2.6"
        strokeLinecap="round"
        className="stroke-primary-foreground"
      />
      <circle cx="11.5" cy="11.5" r="2.6" className="fill-primary-foreground" />
      <circle cx="20.5" cy="20.5" r="2.6" className="fill-primary-foreground" />
    </svg>
  )
}

/** The mark with the lowercase wordmark beside it. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className="text-xl font-bold tracking-[-0.04em]">settlr</span>
    </span>
  )
}
