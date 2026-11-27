import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import {
  AppPreview,
  ClosingCta,
  FeatureGrid,
  HeroCopy,
  LANDING_WIDTH,
  LandingFooter,
} from '#/components/landing'
import { LoginForm } from '#/components/login-form'
import { cn } from '#/lib/utils'
import { getAuthSession } from '#/server/auth.server'

export const metadata: Metadata = { title: 'Settlr · Split costs. Stay friends.' }

// The landing page and sign-in form, fully rendered on the server.
// Signed-in visitors go straight to their dashboard.
export default async function HomePage() {
  if ((await getAuthSession()).user) redirect('/dashboard')
  return (
    // Full width: cancels the signed-out <main>'s gutter and padding (the
    // `app-shell` rule in styles.css), so section backgrounds reach the
    // edges; each section puts the gutter back inside.
    <div className="-mx-(--gutter) -mt-4 -mb-12">
      <section aria-labelledby="hero-title" className="relative isolate">
        {/* A dot grid that fades out from the middle, and the accent's glow
            behind the form. It starts at the top of the window, behind the
            see-through top bar (h-12) and main's top padding, so there's no
            seam under the bar. */}
        <div aria-hidden="true" className="absolute inset-x-0 -top-12 bottom-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(var(--border-strong)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_75%_60%_at_50%_30%,#000_25%,transparent_100%)]" />
          <div className="absolute top-[-12rem] right-[-6rem] size-[42rem] rounded-full bg-primary/12 blur-3xl dark:bg-primary/10" />
        </div>
        <div
          className={cn(
            LANDING_WIDTH,
            'grid items-center gap-12 pt-12 pb-16 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] lg:gap-16 lg:pt-24 lg:pb-24',
          )}
        >
          <HeroCopy />
          {/* The closing "Get started" links here. */}
          <div id="sign-in" className="w-full max-w-[25rem] scroll-mt-20 justify-self-center lg:justify-self-end">
            <LoginForm className="animate-rise-in [animation-delay:120ms]" />
          </div>
        </div>
        <div className={cn(LANDING_WIDTH, 'animate-rise-in pb-4 [animation-delay:200ms]')}>
          <AppPreview />
        </div>
      </section>

      <section aria-labelledby="features-title" className={cn(LANDING_WIDTH, 'py-20 sm:py-28')}>
        <header className="mx-auto mb-10 grid max-w-2xl gap-3 text-center sm:mb-14">
          <p className="text-sm font-medium text-primary">What’s inside</p>
          <h2
            id="features-title"
            className="m-0 text-[clamp(1.75rem,3.6vw,2.5rem)] leading-tight font-semibold tracking-[-0.035em] text-balance"
          >
            Everything a shared tab needs
          </h2>
          <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
            Groups for trips and flats, a running tab with each friend, and your own spending,
            all in one place.
          </p>
        </header>
        <FeatureGrid />
      </section>

      <section aria-labelledby="cta-title" className={cn(LANDING_WIDTH, 'pb-20 sm:pb-28')}>
        <ClosingCta />
      </section>

      <LandingFooter />
    </div>
  )
}
