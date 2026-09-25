import { createFileRoute, redirect } from '@tanstack/react-router'

import { LoginForm } from '#/components/login-form'

// SSR: full. The landing hero and sign-in form: no loader, fully rendered
// HTML. Signed-in visitors go straight to their dashboard.
export const Route = createFileRoute('/')({
  beforeLoad: ({ context }) => {
    if (context.isAuthenticated) throw redirect({ to: '/dashboard' })
  },
  head: () => ({
    meta: [{ title: 'Settlr · Split costs. Stay friends.' }],
  }),
  component: HomePage,
})

function HomePage() {
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
      </div>

      <LoginForm className="hero__login" />
    </section>
  )
}
