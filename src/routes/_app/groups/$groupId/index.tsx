import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { Receipt, Search, Trash2 } from 'lucide-react'

import { ConfirmAction } from '#/components/confirm-action'
import { SelectField } from '#/components/form-fields'
import { useAction } from '#/components/ledger'
import { useGroup } from '#/components/use-group'
import { Badge } from '#/components/ui/badge'
import { Button, buttonVariants } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '#/components/ui/empty'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '#/components/ui/input-group'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '#/components/ui/item'
import { categoryLabel, formatDate, formatMoney, memberName } from '#/lib/format'
import {
  CATEGORIES,
  LIST_STEP,
  expenseSearchDefaults,
  expenseSearchSchema,
  type ExpenseSearch,
} from '#/lib/schemas'
import type { Group, GroupExpense } from '#/lib/types'
import { cn } from '#/lib/utils'
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

const categoryOptions = [
  { value: 'all', label: 'All categories' },
  ...CATEGORIES.map((c) => ({ value: c, label: categoryLabel(c) })),
] as Array<{ value: ExpenseSearch['category']; label: string }>

const ANYONE = 'anyone'

const sortOptions = [
  { value: 'date:desc', label: 'Newest first' },
  { value: 'date:asc', label: 'Oldest first' },
  { value: 'amount:desc', label: 'Largest first' },
  { value: 'amount:asc', label: 'Smallest first' },
] as const

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

      <Card className="py-2">
        <CardContent className="px-2">
          {page.items.length === 0 ? (
            <Empty className="py-10">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Receipt />
                </EmptyMedia>
                <EmptyTitle>
                  {group.expenseCount === 0 ? 'No expenses yet' : 'No matches'}
                </EmptyTitle>
                <EmptyDescription>
                  {group.expenseCount === 0
                    ? 'Add the first expense to start splitting.'
                    : 'No expenses match these filters.'}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ItemGroup>
              {page.items.map((expense) => (
                <ExpenseRow key={expense.id} group={group} expense={expense} />
              ))}
            </ItemGroup>
          )}
        </CardContent>
      </Card>

      {page.hasMore && (
        <Link
          from={Route.fullPath}
          search={(prev) => ({ ...prev, limit: prev.limit + LIST_STEP })}
          resetScroll={false}
          className={cn(buttonVariants({ variant: 'outline' }), 'justify-self-center no-underline')}
        >
          Show more
        </Link>
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
  // Base UI treats an empty value as "nothing selected", so "anyone" (an
  // empty `paidBy` in the URL) gets its own value here.
  const payerOptions = [
    { value: ANYONE, label: 'Anyone paid' },
    ...group.members.map((m) => ({
      value: m.id,
      label: m.id === group.meMemberId ? 'You paid' : `${m.name} paid`,
    })),
  ]

  return (
    <form
      role="search"
      className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(12rem,2fr)_repeat(3,minmax(9rem,1fr))]"
      onSubmit={(event) => {
        event.preventDefault()
        const q = new FormData(event.currentTarget).get('q')
        onChange({ q: typeof q === 'string' ? q.trim() : '' })
      }}
    >
      <InputGroup className="sm:col-span-2 xl:col-span-1">
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          // Keyed on the URL value so back/forward navigation resets the input.
          key={search.q}
          type="search"
          name="q"
          placeholder="Search expenses"
          aria-label="Search expenses"
          defaultValue={search.q}
        />
      </InputGroup>
      <SelectField
        aria-label="Category"
        value={search.category}
        onChange={(category) => onChange({ category })}
        options={categoryOptions}
      />
      <SelectField
        aria-label="Paid by"
        value={search.paidBy || ANYONE}
        onChange={(paidBy) => onChange({ paidBy: paidBy === ANYONE ? '' : paidBy })}
        options={payerOptions}
      />
      <SelectField
        aria-label="Sort"
        value={`${search.sort}:${search.order}` as (typeof sortOptions)[number]['value']}
        onChange={(value) => {
          const [sort, order] = value.split(':') as [
            ExpenseSearch['sort'],
            ExpenseSearch['order'],
          ]
          onChange({ sort, order })
        }}
        options={[...sortOptions]}
      />
    </form>
  )
}

function ExpenseRow({ group, expense }: { group: Group; expense: GroupExpense }) {
  const removeExpense = useConvexMutation(api.groups.removeExpense)
  const { run } = useAction(removeExpense, { success: 'Deleted', toastErrors: true })
  const splitCount = expense.splitAmong.length
  const payer =
    expense.paidBy === group.meMemberId
      ? 'You'
      : memberName(group.members, expense.paidBy)

  return (
    <Item>
      <ItemContent>
        <ItemTitle>
          {expense.description}
          <Badge variant="secondary">{categoryLabel(expense.category)}</Badge>
        </ItemTitle>
        <ItemDescription>
          {formatDate(expense.date)} · {payer} paid · split{' '}
          {splitCount === group.members.length ? 'evenly' : `${splitCount} ways`}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <span className="font-semibold tabular-nums">
          {formatMoney(expense.amountCents, group.currency)}
        </span>
        <ConfirmAction
          title={`Delete “${expense.description}”?`}
          description="Balances will be updated. This can’t be undone."
          onConfirm={async () => Boolean(await run({ expenseId: expense.id }))}
          trigger={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete ${expense.description}`}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 />
            </Button>
          }
        />
      </ItemActions>
    </Item>
  )
}
