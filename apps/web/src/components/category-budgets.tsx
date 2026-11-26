'use client'

import { useState } from 'react'
import { useConvexMutation } from '@convex-dev/react-query'
import { Pencil } from 'lucide-react'
import type { FunctionReturnType } from 'convex/server'

import { CategoryIcon } from '#/components/category'
import { useAction } from '#/components/ledger'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Progress } from '#/components/ui/progress'
import { categoryLabel, formatMoney, parseAmountToCents } from '@settlr/shared/format'
import { CATEGORIES, type Category } from '@settlr/shared/schemas'
import { cn } from '#/lib/utils'
import { api } from '@settlr/backend/convex/_generated/api'

type Budgets = FunctionReturnType<typeof api.budgets.list>
type Spending = FunctionReturnType<typeof api.budgets.monthSpending>

/**
 * Limits per category inside each monthly budget ("₹8,000 of it on food"),
 * with this month's spending against them.
 */
export function CategoryBudgets({ budgets, spending }: { budgets: Budgets; spending: Spending }) {
  if (budgets.length === 0) return null
  return (
    <>
      {budgets.map((budget) => {
        const spent = spending.find((s) => s.currency === budget.currency)?.byCategory ?? {}
        return (
          <Card key={budget.currency}>
            <CardHeader>
              <CardTitle>Category limits · {budget.currency}</CardTitle>
              <CardDescription>
                Optional limits inside your {formatMoney(budget.amountCents, budget.currency)} budget.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {CATEGORIES.map((category) => (
                <CategoryRow
                  key={category}
                  currency={budget.currency}
                  category={category}
                  limit={budget.byCategory[category] ?? null}
                  spent={spent[category] ?? 0}
                />
              ))}
            </CardContent>
          </Card>
        )
      })}
    </>
  )
}

function CategoryRow({
  currency,
  category,
  limit,
  spent,
}: {
  currency: Budgets[number]['currency']
  category: Category
  limit: number | null
  spent: number
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(limit ? (limit / 100).toFixed(0) : '')
  const save = useAction(useConvexMutation(api.budgets.setCategory), { toastErrors: true })
  const pct = limit ? Math.min(100, Math.round((spent / limit) * 100)) : 0
  const over = limit !== null && spent > limit

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center gap-2.5 text-sm">
        <CategoryIcon category={category} />
        <span className="min-w-0 flex-1 font-medium">{categoryLabel(category)}</span>
        {editing ? (
          <form
            className="flex items-center gap-1.5"
            onSubmit={async (event) => {
              event.preventDefault()
              const cents = value.trim() ? parseAmountToCents(value) : null
              if (value.trim() && cents === null) return
              if (await save.run({ currency, category, amountCents: cents })) setEditing(false)
            }}
          >
            <Input
              aria-label={`${categoryLabel(category)} limit`}
              inputMode="decimal"
              value={value}
              placeholder="No limit"
              autoFocus
              onChange={(e) => setValue(e.target.value)}
              className="w-24 text-right tabular-nums"
            />
            <Button type="submit" size="sm" disabled={save.pending}>
              Save
            </Button>
          </form>
        ) : (
          <>
            <span className={cn('tabular-nums', over ? 'text-destructive' : 'text-muted-foreground')}>
              {formatMoney(spent, currency)}
              {limit !== null && ` of ${formatMoney(limit, currency)}`}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Set ${categoryLabel(category)} limit`}
              onClick={() => setEditing(true)}
            >
              <Pencil />
            </Button>
          </>
        )}
      </div>
      {limit !== null && (
        <Progress
          value={pct}
          aria-label={`${categoryLabel(category)} used`}
          className={cn(over && '[&_[data-slot=progress-indicator]]:bg-destructive')}
        />
      )}
    </div>
  )
}
