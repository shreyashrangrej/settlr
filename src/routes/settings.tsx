import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'

import { CurrencySelect } from '#/components/form-fields'
import { PageHeader } from '#/components/page-header'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Field, FieldDescription, FieldLabel } from '#/components/ui/field'
import { readPreferences, writePreferences } from '#/lib/preferences'
import type { Currency } from '#/lib/schemas'

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
  const [currency, setCurrency] = useState<Currency>(initial.defaultCurrency)

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Settings" description="Stored in this browser only." />
      <Card>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            writePreferences({ defaultCurrency: currency })
            toast.success('Settings saved')
          }}
        >
          <CardHeader>
            <CardTitle>Defaults</CardTitle>
            <CardDescription>Used to pre-fill new groups and expenses.</CardDescription>
          </CardHeader>
          <CardContent className="mt-4">
            <Field>
              <FieldLabel htmlFor="default-currency">Default currency</FieldLabel>
              <CurrencySelect
                id="default-currency"
                value={currency}
                onChange={setCurrency}
                className="sm:w-48"
              />
              <FieldDescription>
                You can still pick another currency on any expense.
              </FieldDescription>
            </Field>
          </CardContent>
          <CardFooter className="mt-6 justify-end border-t py-4">
            <Button type="submit" size="lg">
              Save
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
