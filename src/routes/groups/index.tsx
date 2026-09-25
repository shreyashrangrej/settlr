import { Link, createFileRoute } from '@tanstack/react-router'

import { listGroupSummaries } from '#/functions/groups.functions'
import { formatMoney } from '#/lib/format'

// SSR: full (default). The list belongs in the first HTML response.
export const Route = createFileRoute('/groups/')({
  loader: () => listGroupSummaries(),
  component: GroupsPage,
})

function GroupsPage() {
  const groups = Route.useLoaderData()

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Your groups</h1>
          <p className="muted">Shared expenses, balances and who owes whom.</p>
        </div>
        <Link to="/groups/new" className="button button--primary">
          New group
        </Link>
      </div>

      {groups.length === 0 ? (
        <p className="empty">No groups yet. Create one to start splitting.</p>
      ) : (
        <ul className="card-grid">
          {groups.map((group) => (
            <li key={group.id}>
              <Link
                to="/groups/$groupId"
                params={{ groupId: group.id }}
                className="card card--link"
              >
                <h2>{group.name}</h2>
                <p className="muted">
                  {group.memberCount} members · {group.expenseCount} expenses
                </p>
                <p className="card__stat">
                  {formatMoney(group.totalCents, group.currency)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
