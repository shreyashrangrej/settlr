'use client'

import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { RotateCcw, Trash2 } from 'lucide-react'

import { CategoryIcon } from '#/components/category'
import { ConfirmAction } from '#/components/confirm-action'
import { useAction } from '#/components/ledger'
import { PageHeader } from '#/components/page-header'
import { Button } from '#/components/ui/button'
import { Card } from '#/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '#/components/ui/empty'
import { formatDate, formatMoney } from '@settlr/shared/format'
import { api } from '@settlr/backend/convex/_generated/api'

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export function TrashView() {
  const { data: rows } = useSuspenseQuery(convexQuery(api.trash.list, {}))
  const restore = useAction(useConvexMutation(api.trash.restore), {
    success: 'Restored',
    toastErrors: true,
  })
  const purge = useAction(useConvexMutation(api.trash.purge), {
    success: 'Deleted for good',
    toastErrors: true,
  })
  return (
    <>
      <PageHeader
        title="Trash"
        description="Expenses you deleted. They’re kept for 30 days, then deleted with their receipts."
      />
      {rows.length === 0 ? (
        <Empty className="rounded-xl border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Trash2 />
            </EmptyMedia>
            <EmptyTitle>Trash is empty</EmptyTitle>
            <EmptyDescription>Deleted expenses wait here for 30 days in case you need them back.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="p-0">
          <ul className="m-0 list-none p-0">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 border-t border-divider px-3.5 py-3 first:border-t-0">
                <CategoryIcon category={r.category} />
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <span className="truncate font-medium">{r.description}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {r.where ?? 'Personal'} · {formatDate(r.date)} · deleted {formatDate(day(r.deletedAt))}, gone after{' '}
                    {formatDate(day(r.expiresAt))}
                  </span>
                </div>
                <span className="font-medium tabular-nums">{formatMoney(r.amountCents, r.currency)}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={restore.pending}
                  onClick={() => void restore.run({ trashId: r.id })}
                >
                  <RotateCcw />
                  Restore
                </Button>
                <ConfirmAction
                  title={`Delete “${r.description}” for good?`}
                  description="It and its receipt are deleted now. This can’t be undone."
                  onConfirm={async () => Boolean(await purge.run({ trashId: r.id }))}
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${r.description} for good`}
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
