import { useState } from 'react'
import {
  Link,
  createFileRoute,
  getRouteApi,
  stripSearchParams,
  useRouter,
} from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'

import { deleteExpense, listExpenses } from '#/functions/groups.functions'
import { formatDate, formatMoney, memberName } from '#/lib/format'
import {
  CATEGORIES,
  expenseSearchDefaults,
  expenseSearchSchema,
  type ExpenseSearch,
} from '#/lib/schemas'
import type { Expense, Group } from '#/lib/types'

const groupRoute = getRouteApi('/groups/$groupId')

// SSR: full. Filters, sorting and pagination live in the URL, validated by a
// zod schema, so a filtered view is shareable and renders fully on the server.
export const Route = createFileRoute('/groups/$groupId/')({
  validateSearch: expenseSearchSchema,
  // Keep URLs clean: params equal to their defaults are dropped.
  search: { middlewares: [stripSearchParams(expenseSearchDefaults)] },
  // Only re-run the loader when the search params it uses change.
  loaderDeps: ({ search }) => search,
  loader: ({ params, deps }) =>
    listExpenses({ data: { groupId: params.groupId, ...deps } }),
  component: ExpensesPage,
})

function ExpensesPage() {
  const { group } = groupRoute.useLoaderData()
  const page = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  const setSearch = (patch: Partial<ExpenseSearch>) =>
    navigate({
      search: (prev) => ({ ...prev, page: 1, ...patch }),
      replace: true,
    })

  return (
    <>
      <Filters group={group} search={search} onChange={setSearch} />

      {page.items.length === 0 ? (
        <p className="empty">
          {page.total === 0 && isDefaultSearch(search)
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

      {page.pageCount > 1 && (
        <nav className="pagination" aria-label="Pagination">
          <Link
            from={Route.fullPath}
            search={(prev) => ({ ...prev, page: page.page - 1 })}
            disabled={page.page <= 1}
          >
            ← Newer
          </Link>
          <span className="muted">
            Page {page.page} of {page.pageCount} · {page.total} expenses
          </span>
          <Link
            from={Route.fullPath}
            search={(prev) => ({ ...prev, page: page.page + 1 })}
            disabled={page.page >= page.pageCount}
          >
            Older →
          </Link>
        </nav>
      )}
    </>
  )
}

function isDefaultSearch(search: ExpenseSearch) {
  return (Object.keys(expenseSearchDefaults) as Array<keyof ExpenseSearch>)
    .filter((key) => key !== 'page' && key !== 'sort' && key !== 'order')
    .every((key) => search[key] === expenseSearchDefaults[key])
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
            {capitalize(c)}
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
            {m.name} paid
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

function ExpenseRow({ group, expense }: { group: Group; expense: Expense }) {
  const router = useRouter()
  const removeExpense = useServerFn(deleteExpense)
  const [pending, setPending] = useState(false)
  const splitCount = expense.splitAmong.length

  return (
    <li className="expense">
      <div>
        <p className="expense__title">{expense.description}</p>
        <p className="muted">
          {formatDate(expense.date)} · {capitalize(expense.category)} ·{' '}
          {memberName(group.members, expense.paidBy)} paid · split{' '}
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
          onClick={async () => {
            if (!window.confirm(`Delete “${expense.description}”?`)) return
            setPending(true)
            try {
              await removeExpense({
                data: { groupId: group.id, expenseId: expense.id },
              })
              // Refetch every active loader: the list and the balances.
              await router.invalidate()
            } finally {
              setPending(false)
            }
          }}
        >
          Delete
        </button>
      </div>
    </li>
  )
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
