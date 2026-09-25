import { useConvexMutation } from '@convex-dev/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { FormError, useAction } from '#/components/ledger'
import { useGroup } from '#/components/use-group'
import { categoryLabel, parseAmountToCents, todayIsoDate } from '#/lib/format'
import { CATEGORIES, addExpenseInput } from '#/lib/schemas'
import { api } from '#convex/_generated/api'

// SSR: full. The form is plain HTML until hydration; it needs no data beyond
// the group, which the parent route has already loaded.
export const Route = createFileRoute('/_app/groups/$groupId/expenses/new')({
  head: () => ({ meta: [{ title: 'Add expense · Settlr' }] }),
  component: NewExpensePage,
})

function NewExpensePage() {
  const group = useGroup()
  const navigate = Route.useNavigate()
  const addExpense = useConvexMutation(api.groups.addExpense)
  const { run, pending, error, setError } = useAction(addExpense)
  if (!group) return null

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!group) return
    const form = new FormData(event.currentTarget)
    const amountCents = parseAmountToCents(String(form.get('amount') ?? ''))
    if (amountCents === null) {
      setError('Enter an amount like 12.50')
      return
    }

    // Same limits the Convex mutation checks.
    const parsed = addExpenseInput.safeParse({
      description: form.get('description'),
      amountCents,
      paidBy: form.get('paidBy'),
      splitAmong: form.getAll('splitAmong'),
      category: form.get('category'),
      date: form.get('date'),
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
    <form className="card form" onSubmit={onSubmit} noValidate>
      <h2>Add an expense</h2>

      <label>
        Description
        <input name="description" required maxLength={80} placeholder="Dinner" />
      </label>

      <div className="form-row">
        <label>
          Amount ({group.currency})
          <input name="amount" inputMode="decimal" required placeholder="0.00" />
        </label>
        <label>
          Date
          <input name="date" type="date" required defaultValue={todayIsoDate()} />
        </label>
      </div>

      <div className="form-row">
        <label>
          Paid by
          <select name="paidBy" defaultValue={group.meMemberId}>
            {group.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id === group.meMemberId ? `${m.name} (you)` : m.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Category
          <select name="category" defaultValue="food">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset>
        <legend>Split equally between</legend>
        <div className="checkbox-grid">
          {group.members.map((m) => (
            <label key={m.id} className="checkbox">
              <input type="checkbox" name="splitAmong" value={m.id} defaultChecked />
              {m.name}
            </label>
          ))}
        </div>
      </fieldset>

      <FormError error={error} />

      <div className="form-actions">
        <button type="submit" className="button button--primary" disabled={pending}>
          {pending ? 'Saving…' : 'Add expense'}
        </button>
      </div>
    </form>
  )
}
