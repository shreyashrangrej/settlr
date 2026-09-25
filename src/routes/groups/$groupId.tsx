import { Await, Link, Outlet, createFileRoute } from '@tanstack/react-router'

import {
  getGroup,
  getGroupBalances,
} from '#/functions/groups.functions'
import { formatMoney, memberName } from '#/lib/format'
import type { Group, GroupBalances } from '#/lib/types'

// SSR: full, with streaming. The group itself is awaited so the header and
// <title> are in the first flush; balances are returned as an unawaited
// promise, so the server streams the page shell immediately and sends the
// balances into the same response when they resolve.
export const Route = createFileRoute('/groups/$groupId')({
  loader: async ({ params }) => {
    const group = await getGroup({ data: { groupId: params.groupId } })
    const balances = getGroupBalances({ data: { groupId: params.groupId } })
    return { group, balances }
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `${loaderData.group.name} · Settlr` }] : [],
  }),
  component: GroupLayout,
})

function GroupLayout() {
  const { group, balances } = Route.useLoaderData()

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">
            <Link to="/groups">Groups</Link> /
          </p>
          <h1>{group.name}</h1>
          <p className="muted">
            {group.members.map((m) => m.name).join(', ')} · {group.currency}
          </p>
        </div>
        <Link
          to="/groups/$groupId/expenses/new"
          params={{ groupId: group.id }}
          className="button button--primary"
        >
          Add expense
        </Link>
      </div>

      <div className="group-layout">
        <section>
          <nav className="tabs" aria-label="Group sections">
            <Link
              to="/groups/$groupId"
              params={{ groupId: group.id }}
              activeOptions={{ exact: true, includeSearch: false }}
            >
              Expenses
            </Link>
            <Link to="/groups/$groupId/insights" params={{ groupId: group.id }}>
              Insights
            </Link>
          </nav>
          <Outlet />
        </section>

        <aside className="card" aria-labelledby="balances-heading">
          <h2 id="balances-heading">Balances</h2>
          <Await promise={balances} fallback={<BalancesSkeleton group={group} />}>
            {(data) => <Balances group={group} data={data} />}
          </Await>
        </aside>
      </div>
    </>
  )
}

function Balances({ group, data }: { group: Group; data: GroupBalances }) {
  const name = (id: string) => memberName(group.members, id)
  const money = (cents: number) => formatMoney(cents, group.currency)

  return (
    <>
      <ul className="balance-list">
        {data.balances.map((b) => (
          <li key={b.memberId}>
            <span>{name(b.memberId)}</span>
            <span
              className={
                b.netCents > 0 ? 'positive' : b.netCents < 0 ? 'negative' : 'muted'
              }
            >
              {b.netCents > 0 ? '+' : ''}
              {money(b.netCents)}
            </span>
          </li>
        ))}
      </ul>

      <h3>Settle up</h3>
      {data.settlements.length === 0 ? (
        <p className="muted">Everyone is square.</p>
      ) : (
        <ul className="settlement-list">
          {data.settlements.map((s) => (
            <li key={`${s.from}-${s.to}`}>
              <strong>{name(s.from)}</strong> pays <strong>{name(s.to)}</strong>{' '}
              <span className="amount">{money(s.amountCents)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function BalancesSkeleton({ group }: { group: Group }) {
  return (
    <div role="status" aria-label="Calculating balances">
      <ul className="balance-list">
        {group.members.map((m) => (
          <li key={m.id}>
            <span>{m.name}</span>
            <span className="skeleton" />
          </li>
        ))}
      </ul>
      <p className="muted">Working out who owes whom…</p>
    </div>
  )
}
