import { useState } from 'react'
import { useConvexMutation } from '@convex-dev/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'

import { AmountInput, CategorySelect, SelectField } from '#/components/form-fields'
import { useAction } from '#/components/ledger'
import { useGroup } from '#/components/use-group'
import { Button, buttonVariants } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Checkbox } from '#/components/ui/checkbox'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Spinner } from '#/components/ui/spinner'
import { formatMoney, parseAmountToCents, todayIsoDate } from '#/lib/format'
import { addExpenseInput, type Category } from '#/lib/schemas'
import type { Group } from '#/lib/types'
import { api } from '#convex/_generated/api'

// SSR: full. The form needs no data beyond the group, which the parent
// route has already loaded.
export const Route = createFileRoute('/_app/groups/$groupId/expenses/new')({
  head: () => ({ meta: [{ title: 'Add expense · Settlr' }] }),
  component: NewExpensePage,
})

function NewExpensePage() {
  const group = useGroup()
  if (!group) return null
  return <ExpenseForm group={group} />
}

function ExpenseForm({ group }: { group: Group }) {
  const navigate = Route.useNavigate()
  const addExpense = useConvexMutation(api.groups.addExpense)
  const { run, pending, error, setError } = useAction(addExpense, {
    success: 'Expense added',
  })
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayIsoDate)
  const [paidBy, setPaidBy] = useState(group.meMemberId)
  const [category, setCategory] = useState<Category>('food')
  const [splitAmong, setSplitAmong] = useState(() => group.members.map((m) => m.id))

  // Live preview of each person's share (the server does the exact split).
  const cents = parseAmountToCents(amount)
  const share = cents && splitAmong.length ? Math.floor(cents / splitAmong.length) : null

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const amountCents = parseAmountToCents(amount)
    if (amountCents === null) {
      setError('Enter an amount like 12.50')
      return
    }
    // Same limits the Convex mutation checks.
    const parsed = addExpenseInput.safeParse({
      description,
      amountCents,
      paidBy,
      splitAmong,
      category,
      date,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form')
      return
    }
    if (await run({ groupId: group.id, ...parsed.data })) {
      await navigate({ to: '/groups/$groupId', params: { groupId: group.id } })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add an expense</CardTitle>
        <CardDescription>Split equally between the people who shared it.</CardDescription>
      </CardHeader>
      <form noValidate onSubmit={onSubmit}>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="ge-description">Description</FieldLabel>
              <Input
                id="ge-description"
                value={description}
                maxLength={80}
                placeholder="Dinner"
                autoFocus
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="ge-amount">Amount</FieldLabel>
                <AmountInput
                  id="ge-amount"
                  value={amount}
                  onChange={setAmount}
                  currency={group.currency}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="ge-date">Date</FieldLabel>
                <Input
                  id="ge-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="ge-paid-by">Paid by</FieldLabel>
                <SelectField
                  id="ge-paid-by"
                  value={paidBy}
                  onChange={setPaidBy}
                  options={group.members.map((m) => ({
                    value: m.id,
                    label: m.id === group.meMemberId ? `${m.name} (you)` : m.name,
                  }))}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="ge-category">Category</FieldLabel>
                <CategorySelect id="ge-category" value={category} onChange={setCategory} />
              </Field>
            </div>

            <FieldSet>
              <FieldLegend variant="label">Split equally between</FieldLegend>
              <FieldDescription>
                {share !== null
                  ? `${formatMoney(share, group.currency)} each`
                  : 'Everyone is included by default.'}
              </FieldDescription>
              <div className="grid gap-3 sm:grid-cols-2">
                {group.members.map((m) => (
                  <Field key={m.id} orientation="horizontal">
                    <Checkbox
                      id={`split-${m.id}`}
                      checked={splitAmong.includes(m.id)}
                      onCheckedChange={(checked) =>
                        setSplitAmong((current) =>
                          checked
                            ? group.members.map((x) => x.id).filter((id) => id === m.id || current.includes(id))
                            : current.filter((id) => id !== m.id),
                        )
                      }
                    />
                    <FieldLabel htmlFor={`split-${m.id}`} className="font-normal">
                      {m.name}
                      {m.id === group.meMemberId && (
                        <span className="text-muted-foreground">(you)</span>
                      )}
                    </FieldLabel>
                  </Field>
                ))}
              </div>
            </FieldSet>
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
        </CardContent>
        <CardFooter className="mt-6 justify-end gap-2 border-t py-4">
          <Link
            to="/groups/$groupId"
            params={{ groupId: group.id }}
            className={buttonVariants({ variant: 'ghost', size: 'lg' })}
          >
            Cancel
          </Link>
          <Button type="submit" size="lg" disabled={pending}>
            {pending && <Spinner />}
            Add expense
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
