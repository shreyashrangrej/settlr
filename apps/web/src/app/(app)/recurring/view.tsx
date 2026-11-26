'use client'

import { useId, useState } from 'react'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Pause, Play, Plus, Repeat, Trash2 } from 'lucide-react'

import { CategoryIcon } from '#/components/category'
import { ConfirmAction } from '#/components/confirm-action'
import {
  AmountInput,
  CategorySelect,
  CurrencySelect,
  DatePicker,
} from '#/components/form-fields'
import { FormDialog } from '#/components/form-dialog'
import { useAction } from '#/components/ledger'
import { PageHeader } from '#/components/page-header'
import { RepeatSelect, type Repeat as RepeatValue } from '#/components/repeat-select'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card } from '#/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '#/components/ui/empty'
import { Field, FieldError, FieldGroup, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Spinner } from '#/components/ui/spinner'
import { formatDate, formatMoney, parseAmountToCents } from '@settlr/shared/format'
import { readPreferences } from '#/lib/preferences'
import type { Category, Currency } from '@settlr/shared/schemas'
import { api } from '@settlr/backend/convex/_generated/api'

const EVERY = { weekly: 'Every week', monthly: 'Every month', yearly: 'Every year' } as const

export function RecurringView({ today }: { today: string }) {
  const { data: rows } = useSuspenseQuery(convexQuery(api.recurring.list, {}))
  const setPaused = useAction(useConvexMutation(api.recurring.setPaused), { toastErrors: true })
  const remove = useAction(useConvexMutation(api.recurring.remove), {
    success: 'Stopped repeating',
    toastErrors: true,
  })

  return (
    <>
      <PageHeader
        title="Recurring"
        description="Rent, subscriptions and other bills Settlr adds for you on each due date."
        actions={
          <FormDialog
            trigger={<Button />}
            label={
              <>
                <Plus />
                New personal repeat
              </>
            }
            title="A personal expense that repeats"
            description="For one with a friend or a group, add it there and pick how often it repeats."
          >
            {(close) => <PersonalRecurringForm today={today} onSaved={close} />}
          </FormDialog>
        }
      />
      {rows.length === 0 ? (
        <Empty className="rounded-xl border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Repeat />
            </EmptyMedia>
            <EmptyTitle>Nothing repeats yet</EmptyTitle>
            <EmptyDescription>
              When you add an expense, pick “Every month” under Repeats, or set up a personal one here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="p-0">
          <ul className="m-0 list-none p-0">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 border-t border-divider px-3.5 py-3 first:border-t-0">
                <CategoryIcon category={r.category} />
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <span className="flex items-center gap-2 font-medium">
                    <span className="truncate">{r.description}</span>
                    {r.paused && <Badge variant="outline">Paused</Badge>}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {EVERY[r.frequency]} ·{' '}
                    {r.where ? <Link href={r.href}>{r.where}</Link> : 'Personal'}
                    {!r.paused && ` · next ${r.nextDate <= today ? 'today' : formatDate(r.nextDate)}`}
                  </span>
                </div>
                <span className="font-medium tabular-nums">{formatMoney(r.amountCents, r.currency)}</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={r.paused ? `Resume ${r.description}` : `Pause ${r.description}`}
                  title={r.paused ? 'Resume' : 'Pause'}
                  disabled={setPaused.pending}
                  onClick={() => void setPaused.run({ recurringId: r.id, paused: !r.paused })}
                >
                  {r.paused ? <Play /> : <Pause />}
                </Button>
                <ConfirmAction
                  title={`Stop repeating “${r.description}”?`}
                  description="Expenses it already added stay. No new ones are added."
                  confirmLabel="Stop"
                  onConfirm={async () => Boolean(await remove.run({ recurringId: r.id }))}
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Stop repeating ${r.description}`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 />
                    </Button>
                  }
                />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  )
}

function PersonalRecurringForm({ today, onSaved }: { today: string; onSaved: () => void }) {
  const id = useId()
  const create = useAction(useConvexMutation(api.recurring.create), { success: 'Repeating expense set up' })
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<Currency>(() => readPreferences().defaultCurrency)
  const [category, setCategory] = useState<Category>('utilities')
  const [date, setDate] = useState(today)
  const [repeat, setRepeat] = useState<RepeatValue>('monthly')

  return (
    <form
      noValidate
      onSubmit={async (event) => {
        event.preventDefault()
        const amountCents = parseAmountToCents(amount)
        if (amountCents === null) return create.setError('Enter an amount like 12.50')
        if (repeat === 'never') return create.setError('Pick how often it repeats')
        if (
          await create.run({
            kind: 'personal',
            description,
            amountCents,
            currency,
            category,
            frequency: repeat,
            startDate: date,
          })
        )
          onSaved()
      }}
    >
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor={`${id}-d`}>Description</FieldLabel>
          <Input id={`${id}-d`} value={description} maxLength={80} placeholder="Netflix" onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="grid grid-cols-[1fr_6.5rem] gap-3">
          <Field>
            <FieldLabel htmlFor={`${id}-a`}>Amount</FieldLabel>
            <AmountInput id={`${id}-a`} value={amount} onChange={setAmount} currency={currency} />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-c`}>Currency</FieldLabel>
            <CurrencySelect id={`${id}-c`} value={currency} onChange={setCurrency} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor={`${id}-cat`}>Category</FieldLabel>
            <CategorySelect id={`${id}-cat`} value={category} onChange={setCategory} />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-date`}>First date</FieldLabel>
            <DatePicker id={`${id}-date`} value={date} onChange={setDate} />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor={`${id}-r`}>Repeats</FieldLabel>
          <RepeatSelect id={`${id}-r`} value={repeat} onChange={setRepeat} />
        </Field>
        {create.error && <FieldError>{create.error}</FieldError>}
        <Button type="submit" disabled={create.pending}>
          {create.pending && <Spinner />}
          Set it up
        </Button>
      </FieldGroup>
    </form>
  )
}
