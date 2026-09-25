import { createFileRoute } from '@tanstack/react-router'

import { useGroup } from '#/components/use-group'
import { categoryLabel } from '#/lib/format'
import type { Group } from '#/lib/types'

// SSR: data-only. The group is already loaded by the layout (its totals are
// kept on the group document), but this component only renders in the
// browser: everything here is formatted in the viewer's own locale, time
// zone and clock ("3 days ago"), which the server cannot know and would
// otherwise cause hydration mismatches. The server sends the pending
// component in its place.
export const Route = createFileRoute('/_app/groups/$groupId/insights')({
  ssr: 'data-only',
  head: () => ({ meta: [{ title: 'Insights · Settlr' }] }),
  component: InsightsPage,
})

function InsightsPage() {
  const group = useGroup()
  if (!group) return null

  if (group.totalCents === 0) {
    return <p className="empty">Add some expenses to see insights.</p>
  }

  // The browser's default locale as resolved by Intl. Safe here because this
  // component never renders on the server. (Not `navigator.language`, which
  // can be an invalid tag such as "en-US@posix" and make Intl throw.)
  const locale = new Intl.NumberFormat().resolvedOptions().locale
  const money = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: group.currency,
  })
  const format = (cents: number) => money.format(cents / 100)

  return (
    <div className="insights">
      <section className="card">
        <p className="muted">Total spent</p>
        <p className="card__stat">{format(group.totalCents)}</p>
        {group.lastExpenseAt && (
          <p className="muted">
            Last expense added {relativeTime(group.lastExpenseAt, locale)}
          </p>
        )}
      </section>

      <section className="card">
        <h2>By category</h2>
        <BarList
          rows={group.byCategory.map((row) => ({
            key: row.category,
            label: categoryLabel(row.category),
            value: row.cents,
          }))}
          format={format}
        />
      </section>

      <section className="card">
        <h2>By month</h2>
        <BarList
          rows={group.byMonth.map((row) => ({
            key: row.month,
            label: new Intl.DateTimeFormat(locale, {
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            }).format(new Date(`${row.month}-01T00:00:00Z`)),
            value: row.cents,
          }))}
          format={format}
        />
      </section>

      <MemberShares group={group} format={format} />
    </div>
  )
}

function MemberShares({
  group,
  format,
}: {
  group: Group
  format: (cents: number) => string
}) {
  return (
    <section className="card">
      <h2>Paid vs. share</h2>
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Member</th>
            <th scope="col">Paid</th>
            <th scope="col">Share</th>
          </tr>
        </thead>
        <tbody>
          {group.members.map((m) => (
            <tr key={m.id}>
              <th scope="row">
                {m.name}
                {m.id === group.meMemberId && ' (you)'}
              </th>
              <td>{format(m.paidCents)}</td>
              <td>{format(m.owedCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function BarList({
  rows,
  format,
}: {
  rows: Array<{ key: string; label: string; value: number }>
  format: (cents: number) => string
}) {
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <ul className="bar-list">
      {rows.map((row) => (
        <li key={row.key}>
          <div className="bar-list__label">
            <span>{row.label}</span>
            <span className="amount">{format(row.value)}</span>
          </div>
          <div className="bar" aria-hidden="true">
            <span style={{ width: `${(row.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function relativeTime(epochMs: number, locale: string) {
  const seconds = (epochMs - Date.now()) / 1000
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ]
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit)
  }
  return rtf.format(Math.round(seconds), 'second')
}
