import { cn } from '#/lib/utils'

/** The Settlr mark: a split sign on the accent colour. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('size-8 shrink-0', className)}>
      <rect width="32" height="32" rx="8" className="fill-primary" />
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

/**
 * "Settlr by EntApex": the name, with the maker's name smaller and quieter
 * beside it. Sized by the font size it's given (`text-sm`, `text-base`).
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('flex min-w-0 items-baseline gap-[0.4em] whitespace-nowrap', className)}>
      <span className="font-semibold">Settlr</span>{' '}
      <span className="truncate text-[0.72em] font-medium text-muted-foreground">by EntApex</span>
    </span>
  )
}

/** The mark with the wordmark beside it. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <LogoMark className="size-7" />
      <Wordmark className="text-base" />
    </span>
  )
}

/** GitHub's mark (from Primer Octicons, MIT); Lucide has no brand icons. */
export function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor" className={cn('size-4 shrink-0', className)}>
      <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
    </svg>
  )
}
