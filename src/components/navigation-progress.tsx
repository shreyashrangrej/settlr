'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { cn } from '#/lib/utils'

type Phase = 'idle' | 'loading' | 'done'

// Waits this long before showing the bar, so instant navigations (cached
// pages, prefetched links) don't flash it.
const SHOW_AFTER_MS = 80
// Gives up after this long (a navigation to the same URL, or one that failed).
const GIVE_UP_AFTER_MS = 10_000

// Next.js has no global "navigating" state, so the bar starts on clicks on
// in-app links (and on `startNavigation()` for programmatic ones) and
// finishes when the URL changes.
const listeners = new Set<() => void>()

/** Shows the bar for a navigation started in code (e.g. `router.push`). */
export function startNavigation() {
  for (const listener of listeners) listener()
}

/** `router.push`/`replace` that also shows the progress bar. */
export function useAppRouter() {
  const router = useRouter()
  return {
    ...router,
    push: (href: string, options?: { scroll?: boolean }) => {
      startNavigation()
      router.push(href, options)
    },
    replace: (href: string, options?: { scroll?: boolean }) => {
      startNavigation()
      router.replace(href, options)
    },
  }
}

// A plain left click on a same-origin link to another page.
function isInAppNavigation(event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0) return false
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false
  const anchor = (event.target as Element | null)?.closest('a')
  if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return false
  const url = new URL(anchor.href, window.location.href)
  if (url.origin !== window.location.origin) return false
  return url.pathname + url.search !== window.location.pathname + window.location.search
}

/**
 * A thin bar across the top of the page while the next page loads. It
 * creeps towards 85% while loading, then fills and fades out.
 */
export function NavigationProgress() {
  const pathname = usePathname()
  const search = useSearchParams().toString()
  const [phase, setPhase] = useState<Phase>('idle')
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const giveUp = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    const start = () => {
      clearTimeout(timer.current)
      clearTimeout(giveUp.current)
      timer.current = setTimeout(() => setPhase('loading'), SHOW_AFTER_MS)
      giveUp.current = setTimeout(() => {
        clearTimeout(timer.current)
        setPhase('idle')
      }, GIVE_UP_AFTER_MS)
    }
    const onClick = (event: MouseEvent) => {
      if (isInAppNavigation(event)) start()
    }
    listeners.add(start)
    document.addEventListener('click', onClick)
    return () => {
      listeners.delete(start)
      document.removeEventListener('click', onClick)
    }
  }, [])

  // The URL changed: the navigation is done.
  useEffect(() => {
    clearTimeout(timer.current)
    clearTimeout(giveUp.current)
    if (phaseRef.current !== 'loading') return
    setPhase('done')
    timer.current = setTimeout(() => setPhase('idle'), 400)
  }, [pathname, search])

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5"
    >
      <div
        className={cn(
          'h-full origin-left bg-primary shadow-[0_0_8px_var(--accent)]',
          phase === 'idle' && 'scale-x-0 opacity-0 transition-none',
          phase === 'loading' &&
            'scale-x-[0.85] opacity-100 transition-transform duration-[6000ms] ease-out',
          phase === 'done' &&
            'scale-x-100 opacity-0 transition-[transform,opacity] duration-300 ease-out',
        )}
      />
    </div>
  )
}
