import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute, stripSearchParams } from '@tanstack/react-router'

import { useAction } from '#/components/ledger'
import { useGroup } from '#/components/use-group'
import { categoryLabel, formatDate, formatMoney, memberName } from '#/lib/format'
import {
  CATEGORIES,
  LIST_STEP,
  expenseSearchDefaults,
  expenseSearchSchema,
  type ExpenseSearch,
} from '#/lib/schemas'
import type { Group, GroupExpense } from '#/lib/types'
import { api } from '#convex/_generated/api'

// SSR: full. Filters, sorting and the list length live in the URL, validated
// by a zod schema, so a filtered view is shareable and renders fully on the
// server. The list is a live Convex query.
export const Route = createFileRoute('/_app/groups/$groupId/')({
  validateSearch: expenseSearchSchema,
  // Keep URLs clean: params equal to their defaults are dropped.
  search: { middlewares: [stripSearchParams(expenseSearchDefaults)] },
  // Only re-run the loader when the search params it uses change.
  loaderDeps: ({ search }) => search,
  loader: ({ context, params, deps }) =>
    context.queryClient.ensureQueryData(
      convexQuery(api.groups.expenses, { groupId: params.groupId, ...deps }),
    ),
  component: ExpensesPage,
})

function ExpensesPage() {
  const group = useGroup()
  const { groupId } = Route.useParams()
  const search = Route.useSearch()
  const { data: page } = useSuspenseQuery(
    convexQuery(api.groups.expenses, { groupId, ...search }),
  )
  const navigate = Route.useNavigate()
  if (!group) return null

  const setSearch = (patch: Partial<ExpenseSearch>) =>
    navigate({
      search: (prev) => ({ ...prev, limit: LIST_STEP, ...patch }),
      replace: true,
    })

  return (
    <>
      <Filters group={group} search={search} onChange={setSearch} />

      {page.items.length === 0 ? (
        <p className="empty">
          {group.expenseCount === 0
            ? 'No expenses yet.'
            : 'No expenses match these filters.'}
        </p>
      ) : (
        <ul className="expense-list">
          {page.items.map((expense) => (
            <ExpenseRow key={expense.id} group={group} expense={expense} />
          ))}
        </ul>
      )}

      {page.hasMore && (
        <nav className="pagination justify-center" aria-label="More expenses">
          <Link
            from={Route.fullPath}
            search={(prev) => ({ ...prev, limit: prev.limit + LIST_STEP })}
            resetScroll={false}
            className="button"
          >
            Show more
          </Link>
        </nav>
      )}
    </>
  )
}

function Filters({
  group,
  search,
  onChange,
}: {
  group: Group
  search: ExpenseSearch
  onChange: (patch: Partial<ExpenseSearch>) => void
}) {
  return (
    <form
      className="filters"
      role="search"
      onSubmit={(event) => {
        event.preventDefault()
        const q = new FormData(event.currentTarget).get('q')
        onChange({ q: typeof q === 'string' ? q.trim() : '' })
      }}
    >
      <input
        // Keyed on the URL value so back/forward navigation resets the input.
        key={search.q}
        type="search"
        name="q"
        placeholder="Search expenses"
        aria-label="Search expenses"
        defaultValue={search.q}
      />
      <select
        aria-label="Category"
        value={search.category}
        onChange={(event) =>
          onChange({ category: event.target.value as ExpenseSearch['category'] })
        }
      >
        <option value="all">All categories</option>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {categoryLabel(c)}
          </option>
        ))}
      </select>
      <select
        aria-label="Paid by"
        value={search.paidBy}
        onChange={(event) => onChange({ paidBy: event.target.value })}
      >
        <option value="">Anyone paid</option>
        {group.members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.id === group.meMemberId ? 'You paid' : `${m.name} paid`}
          </option>
        ))}
      </select>
      <select
        aria-label="Sort"
        value={`${search.sort}:${search.order}`}
        onChange={(event) => {
          const [sort, order] = event.target.value.split(':') as [
            ExpenseSearch['sort'],
            ExpenseSearch['order'],
          ]
          onChange({ sort, order })
        }}
      >
        <option value="date:desc">Newest first</option>
        <option value="date:asc">Oldest first</option>
        <option value="amount:desc">Largest first</option>
        <option value="amount:asc">Smallest first</option>
      </select>
    </form>
  )
}

function ExpenseRow({ group, expense }: { group: Group; expense: GroupExpense }) {
  const removeExpense = useConvexMutation(api.groups.removeExpense)
  const { run, pending } = useAction(removeExpense)
  const splitCount = expense.splitAmong.length
  const payer =
    expense.paidBy === group.meMemberId
      ? 'You'
      : memberName(group.members, expense.paidBy)

  return (
    <li className="expense">
      <div>
        <p className="expense__title">{expense.description}</p>
        <p className="muted">
          {formatDate(expense.date)} · {categoryLabel(expense.category)} ·{' '}
          {payer} paid · split{' '}
          {splitCount === group.members.length ? 'evenly' : `${splitCount} ways`}
        </p>
      </div>
      <div className="expense__side">
        <span className="amount">
          {formatMoney(expense.amountCents, group.currency)}
        </span>
        <button
          type="button"
          className="button button--ghost"
          disabled={pending}
          aria-label={`Delete ${expense.description}`}
          onClick={() => {
            if (window.confirm(`Delete “${expense.description}”?`)) {
              void run({ expenseId: expense.id })
            }
          }}
        >
          Delete
        </button>
      </div>
    </li>
  )
}
