import { Link, createFileRoute } from '@tanstack/react-router'

import { formatMoney } from '#/lib/format'

// SSR: full. A static landing hero: no loader, fully rendered HTML.
export const Route = createFileRoute('/')({
  head: () => ({
    meta: [{ title: 'Settlr · Split costs. Stay friends.' }],
  }),
  component: HomePage,
})

function HomePage() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero__bg" aria-hidden="true" />

      <div className="hero__copy">
        <p className="hero__eyebrow">
          <span className="hero__pulse" aria-hidden="true" />
          Fewest-payment settle-up
        </p>
        <h1 id="hero-title" className="hero__title">
          Split costs.
          <br />
          <span className="hero__gradient">Stay friends.</span>
        </h1>
        <p className="hero__lede">
          Settlr keeps one shared tab for trips, flats and dinners, then works
          out the fewest payments to get everyone square.
        </p>
        <div className="hero__actions">
          <Link to="/groups/new" className="button button--primary button--lg">
            Start a group
            <span className="button__arrow" aria-hidden="true">
              →
            </span>
          </Link>
          <Link to="/groups" className="button button--lg">
            Browse groups
          </Link>
        </div>
        <ul className="hero__facts">
          <li>Fair to the cent</li>
          <li>Six currencies</li>
          <li>No sign-up</li>
        </ul>
      </div>

      <HeroVisual />
    </section>
  )
}

// Illustrative snapshot of a group, matching the balances the ledger computes
// for the seeded "Lisbon trip".
const DEMO = {
  name: 'Lisbon trip',
  totalCents: 126_435,
  members: [
    { name: 'Ana', hue: 160, netCents: 53_400 },
    { name: 'Ben', hue: 215, netCents: -8_240 },
    { name: 'Chloe', hue: 335, netCents: -26_803 },
    { name: 'Dev', hue: 40, netCents: -18_357 },
  ],
  settlements: [
    { from: 'Chloe', to: 'Ana', cents: 26_803 },
    { from: 'Dev', to: 'Ana', cents: 18_357 },
    { from: 'Ben', to: 'Ana', cents: 8_240 },
  ],
}

const euros = (cents: number) => formatMoney(Math.abs(cents), 'EUR')
const hueOf = (name: string) =>
  DEMO.members.find((m) => m.name === name)?.hue ?? 160

function HeroVisual() {
  const maxNet = Math.max(...DEMO.members.map((m) => Math.abs(m.netCents)))

  return (
    <div
      className="hero__visual"
      role="img"
      aria-label="Example group, Lisbon trip: Ana is owed €534.00, and Chloe, Dev and Ben settle up with three payments to Ana."
    >
      <div className="mock" aria-hidden="true">
        <div className="mock__header">
          <div>
            <p className="mock__label">{DEMO.name}</p>
            <p className="mock__total">{euros(DEMO.totalCents)}</p>
          </div>
          <div className="avatar-stack">
            {DEMO.members.map((m) => (
              <Avatar key={m.name} name={m.name} hue={m.hue} />
            ))}
          </div>
        </div>

        <ul className="mock__balances">
          {DEMO.members.map((m) => {
            const width = `${(Math.abs(m.netCents) / maxNet) * 50}%`
            const owed = m.netCents > 0
            return (
              <li key={m.name}>
                <Avatar name={m.name} hue={m.hue} />
                <span className="mock__name">{m.name}</span>
                <span className="mock__track">
                  <span
                    className={owed ? 'mock__fill is-owed' : 'mock__fill is-owing'}
                    style={{ width }}
                  />
                </span>
                <span className={owed ? 'mock__net positive' : 'mock__net negative'}>
                  {owed ? '+' : '−'}
                  {euros(m.netCents)}
                </span>
              </li>
            )
          })}
        </ul>

        <p className="mock__divider">
          <span>Settle up · {DEMO.settlements.length} payments</span>
        </p>

        <ul className="mock__settlements">
          {DEMO.settlements.map((s) => (
            <li key={s.from}>
              <Avatar name={s.from} hue={hueOf(s.from)} small />
              <span className="mock__flow">
                {s.from} <span className="mock__arrow">→</span> {s.to}
              </span>
              <span className="mock__amount">{euros(s.cents)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="hero__float hero__float--toast" aria-hidden="true">
        <span className="hero__check">✓</span>
        <span>
          Chloe paid Ana <strong>{euros(26_803)}</strong>
        </span>
      </div>
      <div className="hero__float hero__float--stat" aria-hidden="true">
        <strong>3</strong>
        <span>
          payments to
          <br />
          settle everyone
        </span>
      </div>
    </div>
  )
}

function Avatar({
  name,
  hue,
  small = false,
}: {
  name: string
  hue: number
  small?: boolean
}) {
  return (
    <span
      className={small ? 'avatar avatar--sm' : 'avatar'}
      style={{ '--hue': hue } as React.CSSProperties}
    >
      {name.charAt(0)}
    </span>
  )
}
