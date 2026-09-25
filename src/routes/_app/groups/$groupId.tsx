import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import {
  Link,
  Outlet,
  createFileRoute,
  notFound,
  useNavigate,
} from '@tanstack/react-router'
import { Trash2 } from 'lucide-react'

import { FormError, useAction } from '#/components/ledger'
import { useGroup } from '#/components/use-group'
import { Button } from '#/components/ui/button'
import { formatMoney, memberName } from '#/lib/format'
import type { Group } from '#/lib/types'
import { api } from '#convex/_generated/api'

// SSR: full. The group (members, balances and the settle-up plan are kept
// up to date on the group document) is prefetched during SSR and stays live
// afterwards, so adding an expense updates the balances without a refetch.
export const Route = createFileRoute('/_app/groups/$groupId')({
  loader: async ({ context, params }) => {
    const group = await context.queryClient.ensureQueryData(
      convexQuery(api.groups.get, { groupId: params.groupId }),
    )
    if (!group) throw notFound()
    return { name: group.name }
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `${loaderData.name} · Settlr` }] : [],
  }),
  component: GroupLayout,
})

function GroupLayout() {
  const group = useGroup()

  // Deleted while open (here or in another tab).
  if (!group) {
    return (
      <p className="empty">
        This group was deleted. <Link to="/groups">Back to groups</Link>
      </p>
    )
  }

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
          <Balances group={group} />
          <DeleteGroup group={group} />
        </aside>
      </div>
    </>
  )
}

function Balances({ group }: { group: Group }) {
  const name = (id: string) =>
    id === group.meMemberId ? 'You' : memberName(group.members, id)
  const money = (cents: number) => formatMoney(cents, group.currency)

  return (
    <>
      <ul className="balance-list">
        {group.members.map((m) => (
          <li key={m.id}>
            <span>
              {m.name}
              {m.id === group.meMemberId && <span className="muted"> (you)</span>}
            </span>
            <span
              className={
                m.netCents > 0 ? 'positive' : m.netCents < 0 ? 'negative' : 'muted'
              }
            >
              {m.netCents > 0 ? '+' : ''}
              {money(m.netCents)}
            </span>
          </li>
        ))}
      </ul>

      <h3>Settle up</h3>
      {group.settlements.length === 0 ? (
        <p className="muted">Everyone is square.</p>
      ) : (
        <ul className="settlement-list">
          {group.settlements.map((s) => (
            <li key={`${s.from}-${s.to}`}>
              <strong>{name(s.from)}</strong>{' '}
              {s.from === group.meMemberId ? 'pay' : 'pays'}{' '}
              <strong>
                {s.to === group.meMemberId ? 'you' : name(s.to)}
              </strong>{' '}
              <span className="amount">{money(s.amountCents)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function DeleteGroup({ group }: { group: Group }) {
  const removeGroup = useConvexMutation(api.groups.remove)
  const navigate = useNavigate()
  const { run, pending, error } = useAction(removeGroup)

  return (
    <div className="mt-5 grid gap-2 border-t pt-4">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="justify-self-start text-muted-foreground hover:text-destructive"
        disabled={pending}
        onClick={async () => {
          if (!window.confirm(`Delete “${group.name}” and all its expenses?`)) {
            return
          }
          if (await run({ groupId: group.id })) {
            await navigate({ to: '/groups' })
          }
        }}
      >
        <Trash2 />
        Delete group
      </Button>
      <FormError error={error} />
    </div>
  )
}
