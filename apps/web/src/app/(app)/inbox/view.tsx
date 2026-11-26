'use client'

import { useEffect, useId, useState } from 'react'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Copy, Inbox, Mail } from 'lucide-react'
import { toast } from 'sonner'
import type { FunctionReturnType } from 'convex/server'

import { AmountInput, CategorySelect, CurrencySelect, DatePicker } from '#/components/form-fields'
import { useAction } from '#/components/ledger'
import { PageHeader } from '#/components/page-header'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '#/components/ui/empty'
import { Field, FieldError, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Spinner } from '#/components/ui/spinner'
import { parseAmountToCents, todayIsoDate } from '@settlr/shared/format'
import { readPreferences } from '#/lib/preferences'
import type { Category, Currency } from '@settlr/shared/schemas'
import { api } from '@settlr/backend/convex/_generated/api'

type Item = FunctionReturnType<typeof api.inbox.list>[number]

export function InboxView() {
  const { data: items } = useSuspenseQuery(convexQuery(api.inbox.list, {}))
  const { data: profile } = useSuspenseQuery(convexQuery(api.profiles.me, {}))
  return (
    <>
      <PageHeader
        title="Inbox"
        description="Forward receipts and bills to your Settlr address. Each one becomes a draft to add or dismiss."
      />
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="size-4 text-muted-foreground" />
              Your forwarding address
            </CardTitle>
            <CardDescription>
              {profile.inboxAvailable
                ? 'Anything sent here lands below. Keep it private.'
                : 'Email forwarding isn’t set up on this server yet (INBOUND_EMAIL_DOMAIN and INBOUND_EMAIL_SECRET).'}
            </CardDescription>
          </CardHeader>
          {profile.inboxAvailable && (
            <CardContent>
              {profile.inboxAddress ? (
                <div className="flex flex-wrap items-center gap-2">
                  <code className="rounded-md bg-field px-2 py-1 text-sm">{profile.inboxAddress}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(profile.inboxAddress!)
                        .then(() => toast.success('Address copied'))
                    }
                  >
                    <Copy />
                    Copy
                  </Button>
                </div>
              ) : (
                <Link href="/settings">Create your address in Settings</Link>
              )}
            </CardContent>
          )}
        </Card>
        {items.length === 0 ? (
          <Empty className="rounded-xl border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Inbox />
              </EmptyMedia>
              <EmptyTitle>Nothing waiting</EmptyTitle>
              <EmptyDescription>Forwarded emails show up here as drafts.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          items.map((item) => <Draft key={item.id} item={item} />)
        )}
      </div>
    </>
  )
}

function Draft({ item }: { item: Item }) {
  const id = useId()
  const accept = useAction(useConvexMutation(api.inbox.accept), { success: 'Added to personal' })
  const dismiss = useAction(useConvexMutation(api.inbox.dismiss), { toastErrors: true })
  const [description, setDescription] = useState(item.draft?.description ?? item.subject)
  const [amount, setAmount] = useState(
    item.draft?.amountCents ? (item.draft.amountCents / 100).toFixed(2) : '',
  )
  const [currency, setCurrency] = useState<Currency>(item.draft?.currency ?? 'USD')
  // The default currency lives in this browser, so it's read after hydration.
  const drafted = item.draft?.currency
  useEffect(() => {
    if (!drafted) setCurrency(readPreferences().defaultCurrency)
  }, [drafted])
  const [category, setCategory] = useState<Category>(item.draft?.category ?? 'other')
  const [date, setDate] = useState(item.draft?.date ?? todayIsoDate)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="truncate">{item.subject || '(no subject)'}</CardTitle>
        <CardDescription className="truncate">
          From {item.from || 'unknown'} · {item.draft ? 'Read' : 'Reading…'}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="m-0 line-clamp-2 text-xs text-muted-foreground">{item.snippet}</p>
        <form
          className="grid gap-3"
          noValidate
          onSubmit={async (event) => {
            event.preventDefault()
            const amountCents = parseAmountToCents(amount)
            if (amountCents === null) return accept.setError('Enter an amount like 12.50')
            await accept.run({ itemId: item.id, description, amountCents, currency, category, date })
          }}
        >
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr_6.5rem]">
            <Field>
              <FieldLabel htmlFor={`${id}-d`}>Description</FieldLabel>
              <Input id={`${id}-d`} value={description} maxLength={80} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-a`}>Amount</FieldLabel>
              <AmountInput id={`${id}-a`} value={amount} onChange={setAmount} currency={currency} />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-c`}>Currency</FieldLabel>
              <CurrencySelect id={`${id}-c`} value={currency} onChange={setCurrency} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor={`${id}-cat`}>Category</FieldLabel>
              <CategorySelect id={`${id}-cat`} value={category} onChange={setCategory} />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-date`}>Date</FieldLabel>
              <DatePicker id={`${id}-date`} value={date} onChange={setDate} />
            </Field>
          </div>
          {accept.error && <FieldError>{accept.error}</FieldError>}
          <div className="flex gap-2">
            <Button type="submit" disabled={accept.pending}>
              {accept.pending && <Spinner />}
              Add as personal expense
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={dismiss.pending}
              onClick={() => void dismiss.run({ itemId: item.id })}
            >
              Dismiss
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
