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
 * Wraps the page so it animates in when you move to another page. Next.js
 * keeps a page mounted when only its params or search params change (group
 * A to group B, a filter), so a CSS animation on mount wouldn't run on
 * every page change, and would run on filter changes if it did; this
 * plays one on the wrapper whenever the pathname changes instead. Changing
 * filters (the search params) doesn't move the page. Separately, whatever
 * replaces the page's content (its skeleton giving way to the page) fades
 * in, via `animate-fade-in` on the wrapper's children.
 */
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const ref = useRef<HTMLDivElement>(null)
  const shown = useRef(pathname)

  // A layout effect, so the animation starts before the new page paints.
  useLayoutEffect(() => {
    if (shown.current === pathname) return
    shown.current = pathname
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
