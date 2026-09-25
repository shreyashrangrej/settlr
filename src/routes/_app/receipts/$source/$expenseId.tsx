import { convexQuery } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, notFound, type NavigateOptions } from '@tanstack/react-router'
import { ExternalLink, FileText } from 'lucide-react'

import { PageHeader } from '#/components/page-header'
import { ReceiptSkeleton } from '#/components/skeletons'
import { Badge } from '#/components/ui/badge'
import { buttonVariants } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '#/components/ui/empty'
import { categoryLabel, formatDate, formatMoney } from '#/lib/format'
import { cn } from '#/lib/utils'
import { api } from '#convex/_generated/api'

// SSR: full. An expense's receipt, shown inside the app: images inline,
// PDFs in the browser's viewer. `source` is personal, friend or group; the
// query checks the viewer can see that expense (a bad URL is a 404).
export const Route = createFileRoute('/_app/receipts/$source/$expenseId')({
  loader: async ({ context, params }) => {
    const receipt = await context.queryClient.ensureQueryData(
      convexQuery(api.receipts.forExpense, params),
    )
    if (!receipt) throw notFound()
    return { title: receipt.expense.description }
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `Receipt · ${loaderData.title} · Settlr` }] : [],
  }),
  pendingComponent: ReceiptSkeleton,
  component: ReceiptPage,
})

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function ReceiptPage() {
  const params = Route.useParams()
  const { data: receipt } = useSuspenseQuery(convexQuery(api.receipts.forExpense, params))

  // Where "back" goes when there's no history: the expense's page.
  const fallback: NavigateOptions =
    receipt?.expense.source === 'friend' && receipt.expense.parentId
      ? { to: '/friends/$friendId', params: { friendId: receipt.expense.parentId } }
      : receipt?.expense.source === 'group' && receipt.expense.parentId
        ? { to: '/groups/$groupId', params: { groupId: receipt.expense.parentId } }
        : { to: '/personal' }

  // Removed (or the expense deleted) while open.
  if (!receipt) {
    return (
      <div className="mx-auto grid w-full max-w-4xl">
        <PageHeader back={{ fallback, label: 'Back' }} title="Receipt" />
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileText />
            </EmptyMedia>
            <EmptyTitle>This receipt was removed</EmptyTitle>
            <EmptyDescription>The expense no longer has a receipt attached.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  const { expense } = receipt
  return (
    <div className="mx-auto grid w-full max-w-4xl">
      <PageHeader
        back={{ fallback, label: 'Back' }}
        title={expense.description}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground tabular-nums">
              {formatMoney(expense.amountCents, expense.currency)}
            </span>
            · {formatDate(expense.date)}
            <Badge variant="secondary">{categoryLabel(expense.category)}</Badge>
          </span>
        }
        actions={
          <a
            href={receipt.url}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'no-underline')}
          >
            <ExternalLink />
            Open original
          </a>
        }
      />
      <Card className="py-3">
        <CardContent className="grid gap-3 px-3">
          {receipt.isPdf ? (
            <iframe
              src={receipt.url}
              title={`Receipt for ${expense.description}`}
              className="h-[75vh] w-full rounded-lg border bg-muted"
            />
          ) : (
            <div className="grid place-items-center rounded-lg bg-muted p-2">
              <img
                src={receipt.url}
                alt={`Receipt for ${expense.description}`}
                className="max-h-[75vh] w-auto max-w-full rounded-md object-contain"
              />
            </div>
          )}
          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <FileText className="size-3.5" aria-hidden="true" />
            <span className="truncate">{receipt.fileName}</span>· {formatSize(receipt.size)}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
