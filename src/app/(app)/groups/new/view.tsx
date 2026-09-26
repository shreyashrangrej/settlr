'use client'

import { useEffect, useState } from 'react'
import { useConvexMutation } from '@convex-dev/react-query'
import Link from 'next/link'
import { Plus, X } from 'lucide-react'

import { CurrencySelect } from '#/components/form-fields'
import { PersonAvatar, useAction } from '#/components/ledger'
import { useAppRouter } from '#/components/navigation-progress'
import { PageHeader } from '#/components/page-header'
import { useSession } from '#/components/providers'
import { Badge } from '#/components/ui/badge'
import { Button, buttonVariants } from '#/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Spinner } from '#/components/ui/spinner'
import { readPreferences } from '#/lib/preferences'
import { createGroupInput, type Currency } from '#/lib/schemas'
import { api } from '#convex/_generated/api'

export function NewGroupView() {
  const { user } = useSession()
  const createGroup = useConvexMutation(api.groups.create)
  const router = useAppRouter()
  const { run, pending, error, setError } = useAction(createGroup, {
    success: 'Group created',
  })
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState<Currency>('USD')
  // Everyone but you; you're added as the first member.
  const [members, setMembers] = useState([''])

  useEffect(() => setCurrency(readPreferences().defaultCurrency), [])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = createGroupInput.safeParse({
      name,
      currency,
      members: members.map((m) => m.trim()).filter(Boolean),
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form')
      return
    }
    const created = await run(parsed.data)
    if (created) {
      router.push(`/groups/${created.value}`)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        back={{ fallback: '/groups', label: 'Back to groups' }}
        title="New group"
        description="Add the people you’re sharing costs with. They don’t need an account."
      />
      <form noValidate onSubmit={onSubmit} className="grid gap-8">
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <Field>
              <FieldLabel htmlFor="group-name">Name</FieldLabel>
              <Input
                id="group-name"
                value={name}
                maxLength={60}
                placeholder="Weekend in Porto"
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="group-currency">Currency</FieldLabel>
              <CurrencySelect id="group-currency" value={currency} onChange={setCurrency} />
            </Field>
          </div>

          <FieldSet>
            <FieldLegend variant="label">Members</FieldLegend>
            <FieldDescription>Up to 20 people, including you.</FieldDescription>
            <div className="grid gap-2">
              <div className="flex h-9 items-center gap-2.5 rounded-lg border bg-muted/40 px-2.5 text-sm">
                <PersonAvatar name={user?.name || 'You'} size="sm" />
                <span className="truncate">{user?.name || 'You'}</span>
                <Badge variant="secondary" className="ml-auto">You</Badge>
              </div>
              {members.map((member, i) => (
                <div key={i} className="flex gap-2">
                  <Input
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove member ${i + 2}`}
                      onClick={() =>
                        setMembers((current) => current.filter((_, j) => j !== i))
                      }
                    >
                      <X />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {members.length < 19 && (
              <Button
                type="button"
                variant="outline"
                className="justify-self-start"
                onClick={() => setMembers((current) => [...current, ''])}
              >
                <Plus />
                Add member
              </Button>
            )}
          </FieldSet>
          {error && <FieldError>{error}</FieldError>}
        </FieldGroup>
        <div className="flex justify-end gap-2 border-t pt-6">
          <Link href="/groups" className={buttonVariants({ variant: 'ghost', size: 'lg' })}>
            Cancel
          </Link>
          <Button type="submit" size="lg" disabled={pending}>
            {pending && <Spinner />}
            Create group
          </Button>
        </div>
      </form>
    </div>
  )
}
