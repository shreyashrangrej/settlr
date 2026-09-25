import { useState } from 'react'
import { createFileRoute, getRouteApi, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'

import { addExpense } from '#/functions/groups.functions'
import { parseAmountToCents, todayIsoDate } from '#/lib/format'
import { CATEGORIES, addExpenseInput } from '#/lib/schemas'

const groupRoute = getRouteApi('/groups/$groupId')

// SSR: full. The form is plain HTML until hydration; it needs no data beyond
// the group, which the parent route has already loaded.
export const Route = createFileRoute('/groups/$groupId/expenses/new')({
  head: () => ({ meta: [{ title: 'Add expense · Settlr' }] }),
  component: NewExpensePage,
})

function NewExpensePage() {
  const { group } = groupRoute.useLoaderData()
  const router = useRouter()
  const navigate = Route.useNavigate()
  const submitExpense = useServerFn(addExpense)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const amountCents = parseAmountToCents(String(form.get('amount') ?? ''))
    if (amountCents === null) {
      setError('Enter an amount like 12.50')
      return
    }

    // Same schema the server function validates with.
    const parsed = addExpenseInput.safeParse({
      groupId: group.id,
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

    setError(null)
    setPending(true)
    try {
      await submitExpense({ data: parsed.data })
      await router.invalidate()
      await navigate({ to: '/groups/$groupId', params: { groupId: group.id } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save expense')
    } finally {
      setPending(false)
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
          <select name="paidBy" defaultValue={group.members[0]?.id}>
            {group.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Category
          <select name="category" defaultValue="food">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
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

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="form-actions">
        <button type="submit" className="button button--primary" disabled={pending}>
          {pending ? 'Saving…' : 'Add expense'}
        </button>
      </div>
    </form>
  )
}
