import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import {
  AppPreview,
  FeatureGrid,
  HeroCopy,
  LANDING_WIDTH,
  LandingFooter,
  OpenSource,
} from '#/components/landing'
import { LoginForm } from '#/components/login-form'
import { cn } from '#/lib/utils'
import { getAuthSession } from '#/server/auth.server'

export const metadata: Metadata = { title: 'Settlr · Shared expenses, settled' }

// The landing page and sign-in form, fully rendered on the server.
// Signed-in visitors go straight to their dashboard.
export default async function HomePage() {
  if ((await getAuthSession()).user) redirect('/dashboard')
  return (
    // Full width: cancels the signed-out <main>'s gutter and padding (the
    // `app-shell` rule in styles.css), so the footer's rule reaches the
    // edges; each section puts the gutter back inside.
    <div className="-mx-(--gutter) -mt-4 -mb-12">
      <section aria-labelledby="hero-title">
        <div
          className={cn(
            LANDING_WIDTH,
            'grid items-center gap-12 pt-12 pb-16 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] lg:gap-16 lg:pt-24 lg:pb-24',
          )}
        >
          <HeroCopy />
          <div className="w-full max-w-[25rem] justify-self-center lg:justify-self-end">
            <LoginForm className="animate-rise-in [animation-delay:120ms]" />
          </div>
        </div>
        <div className={cn(LANDING_WIDTH, 'animate-rise-in pb-4 [animation-delay:200ms]')}>
          <AppPreview />
        </div>
      </section>

      <section aria-labelledby="features-title" className={cn(LANDING_WIDTH, 'py-20 sm:py-28')}>
        <header className="mb-8 grid max-w-2xl gap-2 sm:mb-10">
          <h2
            id="features-title"
            className="m-0 text-[clamp(1.75rem,3.6vw,2.5rem)] leading-tight font-semibold tracking-[-0.035em] text-balance"
          >
            What Settlr does
          </h2>
          <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
            Groups for trips and flats, a running tab with each friend, and your own spending,
            in one place.
          </p>
        </header>
        <FeatureGrid />
      </section>

      <section aria-labelledby="source-title" className={cn(LANDING_WIDTH, 'pb-20 sm:pb-28')}>
        <OpenSource />
      </section>

      <LandingFooter />
    </div>
  )
}
