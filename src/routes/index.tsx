import { Link, createFileRoute, useRouteContext } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'

import { LoginForm } from '#/components/login-form'
import { Button } from '#/components/ui/button'

// SSR: full. The landing hero: no loader, fully rendered HTML. Signed-in
// visitors get shortcuts into the app instead of the sign-in form.
export const Route = createFileRoute('/')({
  head: () => ({
    meta: [{ title: 'Settlr · Split costs. Stay friends.' }],
  }),
  component: HomePage,
})

function HomePage() {
  const { isAuthenticated } = useRouteContext({ from: '__root__' })

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
        {isAuthenticated && (
          <div className="hero__actions">
            <Button asChild size="lg" className="group h-11 px-5 text-base">
              <Link to="/dashboard">
                Open your dashboard
                <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-11 bg-background px-5 text-base dark:bg-background"
            >
              <Link to="/groups/new">Start a group</Link>
            </Button>
          </div>
        )}
        <ul className="hero__facts">
          <li>Fair to the cent</li>
          <li>Six currencies</li>
          <li>Friends, groups and personal</li>
        </ul>
      </div>

      <LoginForm className="hero__login" />
    </section>
  )
}
