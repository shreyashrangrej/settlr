'use client'

import { Search } from 'lucide-react'

import { SelectField, type Option } from '#/components/form-fields'
import { useAppRouter } from '#/components/navigation-progress'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '#/components/ui/input-group'
import { categoryLabel } from '@settlr/shared/format'
import { searchHref } from '#/lib/search'
import { cn } from '#/lib/utils'
import {
  CATEGORIES,
  LIST_STEP,
  type ExpenseFilter,
} from '@settlr/shared/schemas'

// The filter bar every expense list shares, as Gr8r Studio's list toolbar:
// a small search box, then the category, who paid (where more than one
// person can) and the sort as small selects, in one row above the list.
// The values live in the URL, so a filtered list is shareable and renders
// on the server.

const categoryOptions = [
  { value: 'all', label: 'All categories' },
  ...CATEGORIES.map((c) => ({ value: c, label: categoryLabel(c) })),
] as Array<Option<ExpenseFilter['category']>>

// Base UI treats an empty value as "nothing selected", so "anyone" (an
// empty `paidBy` in the URL) gets its own value here.
const ANYONE = 'anyone'

const sortOptions = [
  { value: 'date:desc', label: 'Newest first' },
  { value: 'date:asc', label: 'Oldest first' },
  { value: 'amount:desc', label: 'Largest first' },
  { value: 'amount:asc', label: 'Smallest first' },
] as const
type SortValue = (typeof sortOptions)[number]['value']

// The selects share a phone-wide row and take their own width from `sm`.
const select = 'min-w-0 flex-1 sm:w-auto sm:flex-none'

/** The filters, with `P` the `paidBy` values the list knows. */
type Filter<P extends string> = Omit<ExpenseFilter, 'paidBy'> & { paidBy: P | '' }

export function ExpenseFilters<P extends string>({
  value,
  onChange,
  payers,
  placeholder = 'Search expenses',
}: {
  value: Filter<P>
  onChange: (patch: Partial<Filter<P>>) => void
  /** Who can have paid, as `paidBy` values; leave out where it's always you. */
  payers?: Array<Option<P>>
  placeholder?: string
}) {
  return (
    <form
      role="search"
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        const q = new FormData(event.currentTarget).get('q')
        onChange({ q: typeof q === 'string' ? q.trim() : '' })
      }}
    >
      <InputGroup className="h-8 w-full sm:h-6.5 sm:w-56">
        <InputGroupAddon className="pl-2.5 text-dim [&>svg:not([class*='size-'])]:size-3.5">
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          className="sm:text-ui"
          // Keyed on the URL value so back/forward navigation resets the input.
          key={value.q}
          type="search"
          name="q"
          placeholder={placeholder}
          aria-label={placeholder}
          defaultValue={value.q}
        />
      </InputGroup>
      <SelectField
        aria-label="Category"
        size="sm"
        className={select}
        value={value.category}
        onChange={(category) => onChange({ category })}
        options={categoryOptions}
      />
      {payers && (
        <SelectField<P | typeof ANYONE>
          aria-label="Paid by"
          size="sm"
          className={select}
          value={value.paidBy || ANYONE}
          onChange={(paidBy) => onChange({ paidBy: paidBy === ANYONE ? '' : (paidBy as P) })}
          options={[{ value: ANYONE, label: 'Anyone paid' }, ...payers]}
        />
      )}
      <SelectField
        aria-label="Sort"
        size="sm"
        className={cn(select, 'sm:ml-auto')}
        value={`${value.sort}:${value.order}` as SortValue}
        onChange={(next) => {
          const [sort, order] = next.split(':') as [ExpenseFilter['sort'], ExpenseFilter['order']]
          onChange({ sort, order })
        }}
        options={[...sortOptions]}
      />
    </form>
  )
}

type SearchValues = Record<string, string | number>

/**
 * URLs for a list page's search params: `hrefFor` builds one, `update`
 * replaces the current one with a patch. A new filter starts a "show more"
 * list from the top again; `clearHref` drops the filters but keeps the rest
 * (the month, say).
 */
export function useListSearch<T extends SearchValues>(
  pathname: string,
  search: T,
  defaults: Partial<T>,
) {
  const router = useAppRouter()
  const hrefFor = (next: T) => searchHref(pathname, next, defaults)
  const reset = ('limit' in search ? { limit: LIST_STEP } : {}) as Partial<T>
  return {
    hrefFor,
    update: (patch: Partial<T>) =>
      router.replace(hrefFor({ ...search, ...reset, ...patch }), { scroll: false }),
    clearHref: hrefFor({
      ...search,
      ...reset,
      q: '',
      category: 'all',
      paidBy: '',
    }),
  }
}
