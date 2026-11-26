'use client'

import { useState } from 'react'
import { useConvex } from 'convex/react'
import { toast } from 'sonner'
import { Download } from 'lucide-react'
import { Spinner } from '#/components/ui/spinner'
import { downloadCsv } from '#/lib/export'
import { errorMessage } from '#/lib/errors'

import { convexQuery } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { ArrowUpRight, Ellipsis, Plus, Receipt, User, Users, Wallet } from 'lucide-react'

import { AddMenu } from '#/components/add-menu'
import { CategoryIcon, groupColor, labelTint } from '#/components/category'
import { ExpenseFilters, toolbarSelect, useListSearch } from '#/components/expense-filters'
import {
  ExpenseRow,
  ExpenseSection,
  ExpenseTable,
  YourShare,
} from '#/components/expense-list'
import { ExpensePage, PageIcon } from '#/components/expense-page'
import { SelectField, type Option } from '#/components/form-fields'
import { PersonAvatar } from '#/components/ledger'
import { MonthNav } from '#/components/month-nav'
import { useAppRouter } from '#/components/navigation-progress'
import { PageHeader } from '#/components/page-header'
import { ReceiptLink } from '#/components/receipts'
import { StatCard, StatGrid } from '#/components/stat-card'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { Progress, ProgressLabel, ProgressValue } from '#/components/ui/progress'
import { categoryLabel, formatMoney, formatMonth, plural } from '@settlr/shared/format'
import {
  LIST_STEP,
  allExpensesSearchDefaults,
  isFiltered,
  type AllExpensesSearch,
} from '@settlr/shared/schemas'
import type { FunctionReturnType } from 'convex/server'
import { api } from '@settlr/backend/convex/_generated/api'

type MonthExpenses = FunctionReturnType<typeof api.expenses.month>
type Item = MonthExpenses['items'][number]

const sourceOptions: Array<Option<AllExpensesSearch['source']>> = [
  { value: 'all', label: 'Everywhere' },
  { value: 'group', label: 'In groups' },
  { value: 'friend', label: 'With friends' },
  { value: 'personal', label: 'Personal' },
]


/**
 * Every expense you're part of in `month`, across groups, friends and
 * personal, laid out like the other expense pages. Each row links to where
 * the expense lives, which is where it's edited.
 */
export function AllExpensesView({
  month,
  thisMonth,
  search,
}: {
  month: string
  thisMonth: string
  search: AllExpensesSearch
}) {
  const { data } = useSuspenseQuery(
    convexQuery(api.expenses.month, {
      month,
      q: search.q,
      category: search.category,
      source: search.source,
      sort: search.sort,
      order: search.order,
      limit: search.limit,
      tag: search.tag,
    }),
  )
  const { hrefFor, update } = useListSearch('/expenses', search, allExpensesSearchDefaults)
  const filtered = isFiltered(search) || search.source !== 'all' || search.tag !== ''
  const total = data.totals.reduce((n, t) => n + t.count, 0)
  const clearHref = hrefFor({
    ...search,
    q: '',
    category: 'all',
    source: 'all',
    tag: '',
    limit: LIST_STEP,
  })

  return (
    <>
      <PageHeader
        media={
          <PageIcon>
            <Receipt />
          </PageIcon>
        }
        title="All expenses"
        description="Everything you spent or shared: groups, friends and personal."
        actions={
          <>
            <MonthNav to="/expenses" month={month} thisMonth={thisMonth} />
            <ExportButton month={month} />
            <AddMenu trigger={<Button />}>
              <Plus />
              Add expense
            </AddMenu>
          </>
        }
      />

      <ExpensePage stats={<MonthStats data={data} />} aside={<ByCategory data={data} />}>
        <ExpenseSection
          filters={
            (total > 0 || filtered) && (
              <ExpenseFilters
                value={search}
                onChange={update}
                extra={
                  <>
                    <SelectField
                      aria-label="Where"
                      size="sm"
                      className={toolbarSelect}
                      value={search.source}
                      onChange={(source) => update({ source })}
                      options={sourceOptions}
                    />
                    {(data.tags.length > 0 || search.tag) && (
                      <SelectField
                        aria-label="Tag"
                        size="sm"
                        className={toolbarSelect}
                        value={search.tag}
                        onChange={(tag) => update({ tag })}
                        options={[
                          { value: '', label: 'Any tag' },
                          ...[...new Set([...data.tags, ...(search.tag ? [search.tag] : [])])].map(
                            (t) => ({ value: t, label: `#${t}` }),
                          ),
                        ]}
                      />
                    )}
                  </>
                }
              />
            )
          }
          empty={
            data.items.length === 0 &&
            (filtered
              ? {
                  icon: <Receipt />,
                  title: 'No matches',
                  description: `No expenses in ${formatMonth(month)} match these filters.`,
                  clearHref,
                }
              : {
                  icon: <Receipt />,
                  title: `No expenses in ${formatMonth(month)}`,
                  description: 'Expenses you add in groups, with friends or for yourself show up here.',
                })
          }
          more={data.hasMore && hrefFor({ ...search, limit: search.limit + LIST_STEP })}
          note={
            data.truncated && 'This month has a lot of expenses; some sources show only their first ones.'
          }
        >
          <ExpenseTable columns={['Where', 'Paid by']}>
            {data.items.map((item) => (
              <AllExpenseRow key={item.key} item={item} month={month} />
            ))}
          </ExpenseTable>
        </ExpenseSection>
      </ExpensePage>
    </>
  )
}

/** Where an expense lives, which is also where it's edited. */
function whereHref(item: Item, month: string) {
  if (item.source === 'group') return `/groups/${item.where?.id}`
  if (item.source === 'friend') return `/friends/${item.where?.id}`
  return `/personal?month=${month}`
}

function AllExpenseRow({ item, month }: { item: Item; month: string }) {
  const where =
    item.source === 'personal' ? (
      <span className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden="true"
          className="grid size-5 shrink-0 place-items-center rounded-md bg-primary-soft text-primary [&_svg]:size-3"
        >
          <Wallet />
        </span>
        <span className="truncate">Personal</span>
      </span>
    ) : item.source === 'group' ? (
      <span className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden="true"
          className="grid size-5 shrink-0 place-items-center rounded-md [&_svg]:size-3"
          style={labelTint(groupColor(item.where?.id ?? ''))}
        >
          <Users />
        </span>
        <span className="truncate">{item.where?.name}</span>
      </span>
    ) : (
      <span className="flex min-w-0 items-center gap-2">
        <PersonAvatar name={item.where?.name ?? ''} size="sm" className="size-5" />
        <span className="truncate">{item.where?.name}</span>
      </span>
    )
  const whereText = item.source === 'personal' ? 'Personal' : (item.where?.name ?? '')

  return (
    <ExpenseRow
      icon={<CategoryIcon category={item.category} />}
      title={item.description}
      tags={item.tags}
      href={whereHref(item, month)}
      receipt={item.hasReceipt && <ReceiptLink source={item.source} expenseId={item.id} />}
      subtitle={categoryLabel(item.category)}
      date={item.date}
      cells={[
        { value: where, folded: whereText },
        { value: item.paidBy, folded: `${item.paidBy} paid` },
      ]}
      amount={
        <>
          <span>{formatMoney(item.amountCents, item.currency)}</span>
          {item.shareCents !== item.amountCents && (
            <YourShare cents={formatMoney(item.shareCents, item.currency)} />
          )}
        </>
      }
      actions={<OpenActions name={item.description} href={whereHref(item, month)} where={whereText} />}
    />
  )
}

/**
 * The row's "⋯" menu, in the same column as on the other expense pages.
 * An expense is changed where it lives, so the menu goes there.
 */
function OpenActions({ name, href, where }: { name: string; href: string; where: string }) {
  const router = useAppRouter()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={`Options for ${name}`} title="Options" />}
      >
        <Ellipsis />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => router.push(href)}>
          <ArrowUpRight />
          Open in {where}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MonthStats({ data }: { data: MonthExpenses }) {
  // Per-source figures are for the main currency (the one with the most
  // spent); the total lists every currency.
  const main = data.totals[0]
  const count = data.totals.reduce((n, t) => n + t.count, 0)
  const figure = (cents: number | undefined) =>
    main && cents ? formatMoney(cents, main.currency) : ''

  return (
    <StatGrid>
      <StatCard
        label={`Your share in ${formatMonth(data.month)}`}
        icon={<Receipt />}
        value={data.totals.map((t) => formatMoney(t.share, t.currency)).join(' + ')}
        hint={count > 0 && plural(count, 'expense')}
      />
      <StatCard label="In groups" icon={<Users />} value={figure(main?.group)} />
      <StatCard label="With friends" icon={<User />} value={figure(main?.friend)} />
      <StatCard label="Personal" icon={<Wallet />} value={figure(main?.personal)} />
    </StatGrid>
  )
}

function ByCategory({ data }: { data: MonthExpenses }) {
  const max = Math.max(...data.byCategory.map((r) => r.cents), 1)
  return (
    <Card>
      <CardHeader>
        <CardTitle>By category</CardTitle>
        <CardDescription>Your share, everywhere.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {data.byCategory.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing to show yet.</p>
        ) : (
          data.byCategory.map((row) => (
            <Progress key={`${row.currency}:${row.category}`} value={(row.cents / max) * 100}>
              <ProgressLabel className="text-sm">{categoryLabel(row.category)}</ProgressLabel>
              <ProgressValue className="ml-auto text-sm font-medium tabular-nums">
                {() => formatMoney(row.cents, row.currency)}
              </ProgressValue>
            </Progress>
          ))
        )}
      </CardContent>
    </Card>
  )
}

/** Downloads the month (every source, payments too) as a CSV file. */
function ExportButton({ month }: { month: string }) {
  const convex = useConvex()
  const [busy, setBusy] = useState(false)
  return (
    <Button
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        try {
          const last = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0))
          const { rows, truncated } = await convex.query(api.exports.range, {
            from: `${month}-01`,
            to: last.toISOString().slice(0, 10),
          })
          downloadCsv(rows, `settlr-${month}.csv`)
          if (truncated) toast.warning('Only the first 5,000 rows were exported.')
        } catch (err) {
          toast.error(errorMessage(err))
        } finally {
          setBusy(false)
        }
      }}
    >
      {busy ? <Spinner /> : <Download />}
      Export
    </Button>
  )
}
