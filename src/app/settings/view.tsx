'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import { CurrencySelect } from '#/components/form-fields'
import { PageHeader } from '#/components/page-header'
import { Button } from '#/components/ui/button'
import { Section } from '#/components/section'
import { Field, FieldDescription, FieldLabel } from '#/components/ui/field'
import { readPreferences, writePreferences } from '#/lib/preferences'
import type { Currency } from '#/lib/schemas'

/**
 * Preferences live in this browser's localStorage, so this only renders in
 * the browser (the page wraps it in <ClientOnly>).
 */
export function SettingsView() {
  const [currency, setCurrency] = useState<Currency>(
    () => readPreferences().defaultCurrency,
  )

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        back={{ fallback: '/', label: 'Back' }}
        title="Settings"
        description="Stored in this browser only."
      />
      <form
        className="grid gap-8"
        onSubmit={(event) => {
          event.preventDefault()
          writePreferences({ defaultCurrency: currency })
          toast.success('Settings saved')
        }}
      >
        <Section title="Defaults" description="Used to pre-fill new groups and expenses.">
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
        </Section>
        <div className="flex justify-end border-t pt-6">
          <Button type="submit" size="lg">
            Save
          </Button>
        </div>
      </form>
    </div>
  )
}
