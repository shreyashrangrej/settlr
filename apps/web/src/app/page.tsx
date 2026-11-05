import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { LoginForm } from '#/components/login-form'
import { DOCS_URL } from '#/lib/site'
import { getAuthSession } from '#/server/auth.server'

export const metadata: Metadata = { title: 'Settlr · Split costs. Stay friends.' }

// The landing hero and sign-in form, fully rendered on the server.
// Signed-in visitors go straight to their dashboard.
export default async function HomePage() {
  if ((await getAuthSession()).user) redirect('/dashboard')
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero__copy">
        <h1 id="hero-title" className="hero__title">
          Split costs.
          <br />
          <span className="hero__accent">Stay friends.</span>
        </h1>
        <p className="hero__lede">
          Settlr keeps one shared tab for trips, flats and dinners, then works
          out the fewest payments to get everyone square.
        </p>
        <ul className="hero__facts">
          <li>Fair to the cent</li>
          <li>Six currencies</li>
          <li>Friends, groups and personal</li>
        </ul>
        <p className="mt-6 text-sm text-muted-foreground [animation-delay:240ms]">
          New here?{' '}
          <a href={DOCS_URL} className="font-medium text-primary underline-offset-4 hover:underline">
            Read the guide →
          </a>
        </p>
      </div>

      <LoginForm className="hero__login" />
    </section>
  )
}
