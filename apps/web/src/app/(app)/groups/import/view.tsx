'use client'

import { useId, useState } from 'react'
import { useConvexMutation } from '@convex-dev/react-query'
import { FileUp } from 'lucide-react'

import { useAction } from '#/components/ledger'
import { useAppRouter } from '#/components/navigation-progress'
import { PageHeader } from '#/components/page-header'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { Field, FieldDescription, FieldError, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Spinner } from '#/components/ui/spinner'
import { SelectField } from '#/components/form-fields'
import { formatMoney, plural } from '@settlr/shared/format'
import { parseSplitwise, type SplitwiseImport } from '#/lib/splitwise'
import { api } from '@settlr/backend/convex/_generated/api'

export function ImportView() {
  const id = useId()
  const router = useAppRouter()
  const [parsed, setParsed] = useState<SplitwiseImport | null>(null)
  const [readError, setReadError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [me, setMe] = useState('0')
  const save = useAction(useConvexMutation(api.imports.splitwise), { success: 'Group imported' })

  async function read(file: File) {
    setReadError(null)
    setParsed(null)
    try {
      const result = parseSplitwise(await file.text())
      setParsed(result)
      setName(file.name.replace(/\.csv$/i, '').replace(/[_-]+/g, ' ').slice(0, 60))
    } catch (err) {
      setReadError(err instanceof Error ? err.message : 'Couldn’t read that file.')
    }
  }

  const total = parsed?.expenses.reduce((a, e) => a + e.amountCents, 0) ?? 0

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <PageHeader
        back={{ fallback: '/groups', label: 'Back to groups' }}
        title="Import from Splitwise"
        description="Bring a group over with its expenses, exact shares and payments."
      />
      <Card>
        <CardHeader>
          <CardTitle>1. Export the group from Splitwise</CardTitle>
          <CardDescription>
            In Splitwise, open the group, then Settings → Export as spreadsheet. You get a CSV file.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Field>
            <FieldLabel htmlFor={`${id}-file`}>CSV file</FieldLabel>
            <Input
              id={`${id}-file`}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void read(file)
              }}
            />
            {readError && <FieldError>{readError}</FieldError>}
          </Field>
        </CardContent>
      </Card>
      {parsed && (
        <Card>
          <CardHeader>
            <CardTitle>2. Check and import</CardTitle>
            <CardDescription>
              {plural(parsed.expenses.length, 'expense')} ({formatMoney(total, parsed.currency)}) and{' '}
              {plural(parsed.payments.length, 'payment')} between {plural(parsed.members.length, 'person', 'people')},
              in {parsed.currency}.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field>
              <FieldLabel htmlFor={`${id}-name`}>Group name</FieldLabel>
              <Input id={`${id}-name`} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-me`}>Which one is you?</FieldLabel>
              <SelectField
                id={`${id}-me`}
                value={me}
                onChange={setMe}
                options={parsed.members.map((m, i) => ({ value: String(i), label: m }))}
              />
              <FieldDescription>
                The others are added by name; link them to friends later from Edit group, or send them the
                group’s join link.
              </FieldDescription>
            </Field>
            {parsed.skipped.length > 0 && (
              <div className="rounded-lg border border-warning/50 bg-field p-3 text-sm">
                <p className="m-0 font-medium">These rows can’t be brought over and will be left out:</p>
                <ul className="mt-1 mb-0 text-xs text-muted-foreground">
                  {parsed.skipped.slice(0, 10).map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                  {parsed.skipped.length > 10 && <li>…and {parsed.skipped.length - 10} more</li>}
                </ul>
              </div>
            )}
            {save.error && <FieldError>{save.error}</FieldError>}
            <Button
              disabled={save.pending || !name.trim()}
              onClick={async () => {
                const done = await save.run({
                  name,
                  currency: parsed.currency,
                  members: parsed.members,
                  me: Number(me),
                  expenses: parsed.expenses,
                  payments: parsed.payments,
                })
                if (done) router.push(`/groups/${done.value}`)
              }}
            >
              {save.pending ? <Spinner /> : <FileUp />}
              Import group
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
