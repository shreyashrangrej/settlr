import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'

import {
  preferencesSchema,
  readPreferences,
  writePreferences,
} from '#/lib/preferences'
import { CURRENCIES } from '#/lib/schemas'

// SSR: off. Preferences live in this browser's localStorage, so neither the
// loader nor the component can run on the server. The server responds with
// the document shell and the pending component; the loader and component run
// after hydration.
export const Route = createFileRoute('/settings')({
  ssr: false,
  loader: () => readPreferences(),
  head: () => ({ meta: [{ title: 'Settings · Settlr' }] }),
  component: SettingsPage,
})

function SettingsPage() {
  const initial = Route.useLoaderData()
  const [saved, setSaved] = useState(false)

  return (
    <form
      className="card form"
      onChange={() => setSaved(false)}
      onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        writePreferences(
          preferencesSchema.parse({
            defaultCurrency: form.get('defaultCurrency'),
          }),
        )
        setSaved(true)
      }}
    >
      <h1>Settings</h1>
      <p className="muted">Stored in this browser only.</p>

      <label>
        Default currency for new groups and expenses
        <select name="defaultCurrency" defaultValue={initial.defaultCurrency}>
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <div className="form-actions">
        <button type="submit" className="button button--primary">
          Save
        </button>
        {saved && (
          <span className="positive" role="status">
            Saved
          </span>
        )}
      </div>
    </form>
  )
}
