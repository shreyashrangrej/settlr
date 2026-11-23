'use client'

import { useLayoutEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

import { prefersReducedMotion } from '#/lib/theme'

// Gr8r's route change: the new page rises into place. Same as the
// `rise-in` keyframes in styles.css.
const RISE_IN: Keyframe[] = [
  { opacity: 0, transform: 'translateY(8px)' },
  { opacity: 1, transform: 'none' },
]
const TIMING: KeyframeAnimationOptions = {
  duration: 360,
  easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
}

/**
 * The page a pathname belongs to: its first two segments. A group's or a
 * friend's pages (`/groups/:id`, `/groups/:id/insights`, `.../edit`) share
 * one, since they share a layout (the header, stats and balances): moving
 * between them shouldn't make that layout jump.
 */
function pageKey(pathname: string) {
  return pathname.split('/').filter(Boolean).slice(0, 2).join('/')
}

/**
 * Wraps the page so it animates in when you move to another page. Next.js
 * keeps a page mounted when only its params or search params change (group
 * A to group B, a filter), so a CSS animation on mount wouldn't run on
 * every page change, and would run on filter changes if it did; this
 * plays one on the wrapper whenever the page (`pageKey`) changes instead.
 * Changing filters (the search params) doesn't move the page. Separately,
 * whatever replaces the page's content (its skeleton giving way to the
 * page) fades in, via `animate-fade-in` on the wrapper's children.
 */
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const ref = useRef<HTMLDivElement>(null)
  const shown = useRef(pageKey(pathname))

  // A layout effect, so the animation starts before the new page paints.
  useLayoutEffect(() => {
    const key = pageKey(pathname)
    if (shown.current === key) return
    shown.current = key
    const element = ref.current
    if (!element || typeof element.animate !== 'function' || prefersReducedMotion()) return
    element.animate(RISE_IN, TIMING)
  }, [pathname])

  return (
    <div ref={ref} className="*:animate-fade-in">
      {children}
    </div>
  )
}
