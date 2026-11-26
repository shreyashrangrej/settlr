'use client'

import { useState } from 'react'
import { useConvexMutation } from '@convex-dev/react-query'
import { useConvex } from 'convex/react'
import Link from 'next/link'
import {
  Archive,
  ArchiveRestore,
  Copy,
  Download,
  Ellipsis,
  History,
  Link2,
  PiggyBank,
} from 'lucide-react'
import { toast } from 'sonner'

import { AmountInput } from '#/components/form-fields'
import { useAction } from '#/components/ledger'
import { Button, buttonVariants } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { Field, FieldDescription, FieldLabel } from '#/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '#/components/ui/input-group'
import { Spinner } from '#/components/ui/spinner'
import { errorMessage } from '#/lib/errors'
import { downloadCsv } from '#/lib/export'
import type { Group } from '#/lib/types'
import { cn } from '#/lib/utils'
import { parseAmountToCents, todayIsoDate } from '@settlr/shared/format'
import { api } from '@settlr/backend/convex/_generated/api'

/**
 * The group's secondary actions in one "⋯" menu: the activity log, links
 * for inviting and sharing, the budget, a CSV export and archiving.
 */
export function GroupMenu({ group }: { group: Group }) {
  const [dialog, setDialog] = useState<'links' | 'budget' | null>(null)
  const convex = useConvex()
  const setArchived = useAction(useConvexMutation(api.groups.setArchived), { toastErrors: true })
  const [exporting, setExporting] = useState(false)

  async function exportCsv() {
    setExporting(true)
    try {
      const { rows, truncated } = await convex.query(api.exports.range, {
        from: '2000-01-01',
        to: todayIsoDate(),
        groupId: group.id,
      })
      downloadCsv(rows, `${group.name.replace(/[^\w-]+/g, '-').toLowerCase()}.csv`)
      if (truncated) toast.warning('Only the first 5,000 rows were exported.')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <Link
        href={`/groups/${group.id}/activity`}
        className={cn(buttonVariants({ variant: 'outline' }), 'no-underline')}
      >
        <History />
        Activity
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="icon" aria-label="More group actions" />}
        >
          {exporting ? <Spinner /> : <Ellipsis />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {group.isOwner && (
            <DropdownMenuItem onClick={() => setDialog('links')}>
              <Link2 />
              Invite and share links
            </DropdownMenuItem>
          )}
          {group.isOwner && (
            <DropdownMenuItem onClick={() => setDialog('budget')}>
              <PiggyBank />
              {group.budgetCents ? 'Change budget' : 'Set a budget'}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => void exportCsv()}>
            <Download />
            Export CSV
          </DropdownMenuItem>
          {group.isOwner && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  const done = await setArchived.run({
                    groupId: group.id,
                    archived: !group.archived,
                  })
                  if (done) toast.success(group.archived ? 'Group restored' : 'Group archived')
                }}
              >
                {group.archived ? <ArchiveRestore /> : <Archive />}
                {group.archived ? 'Unarchive' : 'Archive'}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={dialog === 'links'} onOpenChange={(open) => setDialog(open ? 'links' : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite and share</DialogTitle>
            <DialogDescription>
              Anyone with a link can use it. Turn a link off, or make a new one, to stop an old one
              working.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 pt-2">
            <LinkField
              group={group}
              kind="invite"
              label="Join link"
              hint="People who open it sign in and join, as a member already in the list or as a new one."
              token={group.inviteToken}
              path="/join/"
            />
            <LinkField
              group={group}
              kind="share"
              label="Read-only link"
              hint="Shows balances and expenses without signing in. Nobody can change anything there."
              token={group.shareToken}
              path="/share/"
            />
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={dialog === 'budget'} onOpenChange={(open) => setDialog(open ? 'budget' : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Group budget</DialogTitle>
            <DialogDescription>
              A spending limit for the whole group, like a trip budget. The group page shows how much is left.
            </DialogDescription>
          </DialogHeader>
          <BudgetForm group={group} onDone={() => setDialog(null)} />
        </DialogContent>
      </Dialog>
    </>
  )
}

function LinkField({
  group,
  kind,
  label,
  hint,
  token,
  path,
}: {
  group: Group
  kind: 'invite' | 'share'
  label: string
  hint: string
  token: string | null
  path: string
}) {
  const setLink = useAction(useConvexMutation(api.groups.setLink), { toastErrors: true })
  const url = token ? `${window.location.origin}${path}${token}` : ''
  return (
    <Field>
      <FieldLabel htmlFor={`link-${kind}`}>{label}</FieldLabel>
      {token ? (
        <InputGroup>
          <InputGroupInput id={`link-${kind}`} readOnly value={url} onFocus={(e) => e.target.select()} />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              aria-label="Copy link"
              onClick={() => {
                void navigator.clipboard.writeText(url).then(() => toast.success('Link copied'))
              }}
            >
              <Copy />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      ) : null}
      <FieldDescription>{hint}</FieldDescription>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={setLink.pending}
          onClick={() => void setLink.run({ groupId: group.id, link: kind, enabled: true })}
        >
          {token ? 'Make a new link' : 'Turn on'}
        </Button>
        {token && (
          <Button
            variant="ghost"
            size="sm"
            disabled={setLink.pending}
            onClick={() => void setLink.run({ groupId: group.id, link: kind, enabled: false })}
          >
            Turn off
          </Button>
        )}
      </div>
    </Field>
  )
}

function BudgetForm({ group, onDone }: { group: Group; onDone: () => void }) {
  const [amount, setAmount] = useState(group.budgetCents ? (group.budgetCents / 100).toFixed(2) : '')
  const save = useAction(useConvexMutation(api.groups.setBudget), {
    success: 'Budget saved',
  })
  return (
    <form
      className="grid gap-4 pt-2"
      onSubmit={async (event) => {
        event.preventDefault()
        const cents = amount.trim() ? parseAmountToCents(amount) : null
        if (amount.trim() && cents === null) {
          save.setError('Enter an amount like 500')
          return
        }
        if (await save.run({ groupId: group.id, budgetCents: cents })) onDone()
      }}
    >
      <Field>
        <FieldLabel htmlFor="group-budget">Budget</FieldLabel>
        <AmountInput id="group-budget" value={amount} onChange={setAmount} currency={group.currency} />
        <FieldDescription>Leave it empty to remove the budget.</FieldDescription>
      </Field>
      {save.error && <p className="text-sm text-destructive">{save.error}</p>}
      <Button type="submit" disabled={save.pending}>
        {save.pending && <Spinner />}
        Save
      </Button>
    </form>
  )
}
