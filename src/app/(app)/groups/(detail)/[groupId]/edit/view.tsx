'use client'

import { useRef, useState } from 'react'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Plus, Trash2, X } from 'lucide-react'

import { ConfirmAction } from '#/components/confirm-action'
import { CurrencySelect, SelectField } from '#/components/form-fields'
import { PersonAvatar, useAction } from '#/components/ledger'
import { useAppRouter } from '#/components/navigation-progress'
import { useGroup } from '#/components/use-group'
import { Badge } from '#/components/ui/badge'
import { Button, buttonVariants } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '#/components/ui/field'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '#/components/ui/empty'
import { Input } from '#/components/ui/input'
import { Spinner } from '#/components/ui/spinner'
import { editGroupInput, type Currency } from '#/lib/schemas'
import type { Group } from '#/lib/types'
import { api } from '#convex/_generated/api'
import type { Id } from '#convex/_generated/dataModel'

/** Only the group's creator can edit it; members see why not. */
export function EditGroupView() {
  const group = useGroup()
  if (!group) return null
  if (!group.isOwner) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyTitle>Only the group’s creator can edit it</EmptyTitle>
          <EmptyDescription>
            You can still add expenses to {group.name}.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  return (
    <div className="grid max-w-3xl gap-4">
      <EditGroupForm group={group} />
      <DangerZone group={group} />
    </div>
  )
}

type MemberRow = {
  // Stable React key; `id` is only set for members that already exist.
  key: string
  id?: string
  name: string
  // The connected friend this member is, if any.
  friendId: string | null
}

const NOT_LINKED = 'none'

const MAX_MEMBERS = 20

function EditGroupForm({ group }: { group: Group }) {
  const router = useAppRouter()
  const updateGroup = useConvexMutation(api.groups.update)
  const { run, pending, error, setError } = useAction(updateGroup, {
    success: 'Group updated',
  })
  const [name, setName] = useState(group.name)
  const [currency, setCurrency] = useState<Currency>(group.currency)
  const [members, setMembers] = useState<Array<MemberRow>>(() =>
    group.members.map((m) => ({
      key: m.id,
      id: m.id,
      name: m.name,
      friendId: m.friendId,
    })),
  )
  const { data: friends } = useSuspenseQuery(convexQuery(api.friends.list, {}))
  const connected = friends.filter((f) => f.status === 'linked')
  const accountOptions = [
    { value: NOT_LINKED, label: 'Not on Settlr' },
    ...connected.map((f) => ({ value: f.id as string, label: f.name })),
  ]
  const newKey = useRef(0)
  const [focusKey, setFocusKey] = useState<string | null>(null)

  const hasExpenses = group.expenseCount > 0
  // Members with a paid amount or a share are on expenses. (The server also
  // catches the rare 0¢ share.)
  const onExpenses = new Set(
    group.members.filter((m) => m.paidCents !== 0 || m.owedCents !== 0).map((m) => m.id),
  )

  function addMember() {
    const key = `new-${newKey.current++}`
    setMembers((current) => [...current, { key, name: '', friendId: null }])
    setFocusKey(key)
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const parsed = editGroupInput.safeParse({
      name,
      currency,
      members: members.map((m) => ({ id: m.id, name: m.name, friendId: m.friendId })),
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form')
      return
    }
    if (
      await run({
        groupId: group.id,
        ...parsed.data,
        members: parsed.data.members.map((m) => ({
          ...m,
          friendId: m.friendId as Id<'friends'> | null,
        })),
      })
    ) {
      router.push(`/groups/${group.id}`)
      // The data updates live, but the page <title> comes from the group
      // layout's metadata, so render it again for a renamed group.
      router.refresh()
    }
  }

  return (
    <Card>
      <form noValidate onSubmit={onSubmit}>
        <CardHeader>
          <CardTitle>Edit group</CardTitle>
          <CardDescription>
            Rename the group, and add, rename or remove members.
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-4">
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
              <Field>
                <FieldLabel htmlFor="edit-group-name">Name</FieldLabel>
                <Input
                  id="edit-group-name"
                  value={name}
                  maxLength={60}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field data-disabled={hasExpenses || undefined}>
                <FieldLabel htmlFor="edit-group-currency">Currency</FieldLabel>
                {hasExpenses ? (
                  // Amounts are stored in the group's currency, so it's fixed
                  // once there are expenses.
                  <Input id="edit-group-currency" value={currency} disabled />
                ) : (
                  <CurrencySelect
                    id="edit-group-currency"
                    value={currency}
                    onChange={setCurrency}
                  />
                )}
              </Field>
            </div>
            {hasExpenses && (
              <FieldDescription className="-mt-4">
                The currency can’t change once a group has expenses.
              </FieldDescription>
            )}

            <FieldSet>
              <FieldLegend variant="label">
                Members{' '}
                <span className="font-normal text-muted-foreground">
                  ({members.length} of {MAX_MEMBERS})
                </span>
              </FieldLegend>
              <FieldDescription>
                Link a member to a friend on Settlr and they can see this group,
                add expenses and get notified. People who are part of an
                expense can’t be removed until those expenses are deleted.
              </FieldDescription>
              <ul className="grid gap-2">
                {members.map((member, i) => {
                  const isMe = member.id === group.meMemberId
                  const locked = member.id !== undefined && onExpenses.has(member.id)
                  return (
                    <li key={member.key} className="flex items-center gap-2">
                      <PersonAvatar name={member.name || '?'} size="sm" />
                      <Input
                        aria-label={`Member ${i + 1}`}
                        value={member.name}
                        maxLength={40}
                        placeholder="Name"
                        disabled={isMe}
                        autoFocus={member.key === focusKey}
                        onChange={(e) =>
                          setMembers((current) =>
                            current.map((m) =>
                              m.key === member.key ? { ...m, name: e.target.value } : m,
                            ),
                          )
                        }
                      />
                      {!isMe && (
                        <SelectField
                          aria-label={`${member.name || 'Member'}’s Settlr account`}
                          className="w-40 shrink-0"
                          value={member.friendId ?? NOT_LINKED}
                          options={accountOptions}
                          onChange={(value) =>
                            setMembers((current) =>
                              current.map((m) => {
                                if (m.key !== member.key) return m
                                const friendId = value === NOT_LINKED ? null : value
                                // A new, unnamed member takes the friend's name.
                                const friend = connected.find((f) => f.id === friendId)
                                return {
                                  ...m,
                                  friendId,
                                  name: m.name || friend?.name || '',
                                }
                              }),
                            )
                          }
                        />
                      )}
                      {isMe ? (
                        <Badge variant="secondary" className="w-24 justify-center">
                          You
                        </Badge>
                      ) : locked ? (
                        <Badge
                          variant="outline"
                          className="w-24 justify-center text-muted-foreground"
                          title="Delete their expenses to remove them"
                        >
                          On expenses
                        </Badge>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          className="w-24 text-muted-foreground hover:text-destructive"
                          aria-label={`Remove ${member.name || 'member'}`}
                          onClick={() =>
                            setMembers((current) =>
                              current.filter((m) => m.key !== member.key),
                            )
                          }
                        >
                          <X />
                          Remove
                        </Button>
                      )}
                    </li>
                  )
                })}
              </ul>
              {members.length < MAX_MEMBERS && (
                <Button
                  type="button"
                  variant="outline"
                  className="justify-self-start"
                  onClick={addMember}
                >
                  <Plus />
                  Add member
                </Button>
              )}
            </FieldSet>
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
        </CardContent>
        <CardFooter className="mt-6 justify-end gap-2 border-t py-4">
          <Link
            href={`/groups/${group.id}`}
            className={buttonVariants({ variant: 'ghost', size: 'lg' })}
          >
            Cancel
          </Link>
          <Button type="submit" size="lg" disabled={pending}>
            {pending && <Spinner />}
            Save changes
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

function DangerZone({ group }: { group: Group }) {
  const removeGroup = useConvexMutation(api.groups.remove)
  const router = useAppRouter()
  const { run } = useAction(removeGroup, {
    success: 'Group deleted',
    toastErrors: true,
  })

  return (
    <Card className="ring-destructive/30">
      <CardHeader>
        <CardTitle>Danger zone</CardTitle>
        <CardDescription>
          Deleting the group removes it and all {group.expenseCount} of its
          expenses for good.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ConfirmAction
          title={`Delete “${group.name}”?`}
          description="This deletes the group and all of its expenses. It can’t be undone."
          onConfirm={async () => {
            if (!(await run({ groupId: group.id }))) return false
            router.push('/groups')
            return true
          }}
          trigger={
            <Button variant="destructive">
              <Trash2 />
              Delete group
            </Button>
          }
        />
      </CardContent>
    </Card>
  )
}
