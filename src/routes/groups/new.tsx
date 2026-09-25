import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'

import { createGroup } from '#/functions/groups.functions'
import { readPreferences } from '#/lib/preferences'
import { CURRENCIES, createGroupInput, type Currency } from '#/lib/schemas'

// SSR: full. The form renders on the server with neutral defaults; browser
// preferences (localStorage) are applied after hydration in an effect.
export const Route = createFileRoute('/groups/new')({
  head: () => ({ meta: [{ title: 'New group · Settlr' }] }),
  component: NewGroupPage,
})

function NewGroupPage() {
  const submitGroup = useServerFn(createGroup)
  const [currency, setCurrency] = useState<Currency>('USD')
  const [members, setMembers] = useState(['', ''])
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    const prefs = readPreferences()
    setCurrency(prefs.defaultCurrency)
    if (prefs.displayName) {
      setMembers((current) =>
        current[0] === '' ? [prefs.displayName, ...current.slice(1)] : current,
      )
    }
  }, [])

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

    setError(null)
    setPending(true)
    try {
      // The server function throws a redirect to the new group, which
      // `useServerFn` follows as a client-side navigation.
      await submitGroup({ data: parsed.data })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create group')
      setPending(false)
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
        {members.map((member, i) => (
          <div key={i} className="member-input">
            <input
              aria-label={`Member ${i + 1}`}
              value={member}
              maxLength={40}
              placeholder={`Member ${i + 1}`}
              onChange={(event) =>
                setMembers((current) =>
                  current.map((m, j) => (j === i ? event.target.value : m)),
                )
              }
            />
            {members.length > 2 && (
              <button
                type="button"
                className="button button--ghost"
                aria-label={`Remove member ${i + 1}`}
                onClick={() =>
                  setMembers((current) => current.filter((_, j) => j !== i))
                }
              >
                Remove
              </button>
            )}
          </div>
        ))}
        {members.length < 20 && (
          <button
            type="button"
            className="button"
            onClick={() => setMembers((current) => [...current, ''])}
          >
            Add member
          </button>
        )}
      </fieldset>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="form-actions">
        <button type="submit" className="button button--primary" disabled={pending}>
          {pending ? 'Creating…' : 'Create group'}
        </button>
      </div>
    </form>
  )
}
