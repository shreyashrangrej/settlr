'use client'

import { useEffect, useState } from 'react'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Users } from 'lucide-react'

import { PersonAvatar, useAction } from '#/components/ledger'
import { useAppRouter } from '#/components/navigation-progress'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '#/components/ui/empty'
import { FieldError } from '#/components/ui/field'
import { Spinner } from '#/components/ui/spinner'
import { cn } from '#/lib/utils'
import { api } from '@settlr/backend/convex/_generated/api'

/** Pick which member you are (or join as someone new) and join the group. */
export function JoinView({ token }: { token: string }) {
  const router = useAppRouter()
  const { data: invite, isPending } = useQuery(convexQuery(api.groups.invite, { token }))
  const join = useAction(useConvexMutation(api.groups.join))
  const [pick, setPick] = useState<string | null>(null)
  const memberOf = invite?.alreadyMember ? invite.groupId : null
  useEffect(() => {
    if (memberOf) router.replace(`/groups/${memberOf}`)
  }, [memberOf, router])

  if (isPending) return <Spinner className="mx-auto mt-10" />
  if (!invite) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>This invite link doesn’t work</EmptyTitle>
          <EmptyDescription>
            It may have been turned off. Ask for a new one, or go to <Link href="/groups">your groups</Link>.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  if (invite.alreadyMember) return <Spinner className="mx-auto mt-10" />

  return (
    <div className="mx-auto max-w-md py-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            Join {invite.name}
          </CardTitle>
          <CardDescription>
            Which one is you? Picking a name keeps that person’s expenses and balance.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-2" role="radiogroup" aria-label="Who are you?">
            {invite.open.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={pick === m.id}
                onClick={() => setPick(m.id)}
                className={cn(
                  'flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-left',
                  pick === m.id && 'border-primary ring-2 ring-primary-soft',
                )}
              >
                <PersonAvatar name={m.name} size="sm" />
                <span className="font-medium">{m.name}</span>
              </button>
            ))}
            {!invite.full && (
              <button
                type="button"
                role="radio"
                aria-checked={pick === null}
                onClick={() => setPick(null)}
                className={cn(
                  'rounded-lg border border-dashed px-3 py-2.5 text-left text-sm',
                  pick === null && 'border-primary ring-2 ring-primary-soft',
                )}
              >
                I’m not on the list: join as a new member
              </button>
            )}
          </div>
          {join.error && <FieldError>{join.error}</FieldError>}
          <Button
            disabled={join.pending || (invite.full && pick === null)}
            onClick={async () => {
              const done = await join.run({ token, memberId: pick })
              if (done) router.push(`/groups/${done.value}`)
            }}
          >
            {join.pending && <Spinner />}
            Join group
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
