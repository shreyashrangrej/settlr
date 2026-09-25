import { useEffect, useRef, useState } from 'react'
import { useRouterState } from '@tanstack/react-router'

import { cn } from '#/lib/utils'

type Phase = 'idle' | 'loading' | 'done'

// Waits this long before showing the bar, so instant navigations (cached
// data, preloaded on hover) don't flash it.
const SHOW_AFTER_MS = 80

/**
 * A thin bar across the top of the page while the router loads the next
 * route. It creeps towards 85% while loading, then fills and fades out.
 */
export function NavigationProgress() {
  const loading = useRouterState({
    select: (state) => state.isLoading || state.status === 'pending',
  })
  const [phase, setPhase] = useState<Phase>('idle')
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => setPhase('loading'), SHOW_AFTER_MS)
      return () => clearTimeout(timer)
    }
    if (phaseRef.current !== 'loading') return
    setPhase('done')
    const timer = setTimeout(() => setPhase('idle'), 400)
    return () => clearTimeout(timer)
  }, [loading])

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
