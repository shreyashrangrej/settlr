import { convexQuery } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'

import { SignedAmount } from '#/components/ledger'
import { formatMoney } from '#/lib/format'
import { api } from '#convex/_generated/api'

// SSR: full. The group list belongs in the first HTML response; after
// hydration it stays live.
export const Route = createFileRoute('/_app/groups/')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(convexQuery(api.groups.list, {})),
  head: () => ({ meta: [{ title: 'Groups · Settlr' }] }),
  component: GroupsPage,
})

function GroupsPage() {
  const { data: groups } = useSuspenseQuery(convexQuery(api.groups.list, {}))

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Your groups</h1>
          <p className="muted">Trips, flats and dinners: shared tabs and who owes whom.</p>
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
                <p className="text-sm">
                  {group.myNetCents === 0 ? (
                    <span className="muted">You’re square</span>
                  ) : (
                    <>
                      <span className="muted">
                        {group.myNetCents > 0 ? 'You’re owed ' : 'You owe '}
                      </span>
                      <SignedAmount
                        cents={group.myNetCents}
                        currency={group.currency}
                      />
                    </>
                  )}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
