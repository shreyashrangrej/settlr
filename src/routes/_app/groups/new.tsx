import { useEffect, useState } from 'react'
import { useConvexMutation } from '@convex-dev/react-query'
import { createFileRoute, useNavigate, useRouteContext } from '@tanstack/react-router'

import { FormError, useAction } from '#/components/ledger'
import { readPreferences } from '#/lib/preferences'
import { CURRENCIES, createGroupInput, type Currency } from '#/lib/schemas'
import { api } from '#convex/_generated/api'

// SSR: full. The form renders on the server with neutral defaults; browser
// preferences (localStorage) are applied after hydration in an effect.
export const Route = createFileRoute('/_app/groups/new')({
  head: () => ({ meta: [{ title: 'New group · Settlr' }] }),
  component: NewGroupPage,
})

function NewGroupPage() {
  const { user } = useRouteContext({ from: '__root__' })
  const createGroup = useConvexMutation(api.groups.create)
  const navigate = useNavigate()
  const { run, pending, error, setError } = useAction(createGroup)
  const [currency, setCurrency] = useState<Currency>('USD')
  // Everyone but you; you're added as the first member.
  const [members, setMembers] = useState([''])

  useEffect(() => setCurrency(readPreferences().defaultCurrency), [])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const parsed = createGroupInput.safeParse({
      name: form.get('name'),
      currency,
      members: members.map((m) => m.trim()).filter(Boolean),
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form')
      return
    }
    const created = await run(parsed.data)
    if (created) {
      await navigate({
        to: '/groups/$groupId',
        params: { groupId: created.value },
      })
    }
  }

  return (
    <form className="card form" onSubmit={onSubmit} noValidate>
      <h1>New group</h1>

      <div className="form-row">
        <label>
          Name
          <input name="name" required maxLength={60} placeholder="Weekend in Porto" />
        </label>
        <label>
          Currency
          <select
            name="currency"
            value={currency}
            onChange={(event) => setCurrency(event.target.value as Currency)}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset>
        <legend>Members</legend>
        <div className="member-input">
          <input
            aria-label="You"
            value={`${user?.name || 'You'} (you)`}
            readOnly
            disabled
          />
        </div>
        {members.map((member, i) => (
          <div key={i} className="member-input">
            <input
              aria-label={`Member ${i + 2}`}
              value={member}
              maxLength={40}
              placeholder={`Member ${i + 2}`}
              // Focus a row added with "Add member" (not the first one).
              autoFocus={i > 0 && i === members.length - 1}
              onChange={(event) =>
                setMembers((current) =>
                  current.map((m, j) => (j === i ? event.target.value : m)),
                )
              }
            />
            {members.length > 1 && (
              <button
                type="button"
                className="button button--ghost"
                aria-label={`Remove member ${i + 2}`}
                onClick={() =>
                  setMembers((current) => current.filter((_, j) => j !== i))
                }
              >
                Remove
              </button>
            )}
          </div>
        ))}
        {members.length < 19 && (
          <button
            type="button"
            className="button"
            onClick={() => setMembers((current) => [...current, ''])}
          >
            Add member
          </button>
        )}
      </fieldset>

      <FormError error={error} />

      <div className="form-actions">
        <button type="submit" className="button button--primary" disabled={pending}>
          {pending ? 'Creating…' : 'Create group'}
        </button>
      </div>
    </form>
  )
}
