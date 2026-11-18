'use client'

import { createContext, use } from 'react'
import Link from 'next/link'
import { Pencil, Trash2 } from 'lucide-react'

import { ConfirmAction } from '#/components/confirm-action'
import { EditDialog } from '#/components/edit-dialog'
import { Button, buttonVariants } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '#/components/ui/empty'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { formatDate } from '@settlr/shared/format'
import { cn } from '#/lib/utils'

// The expense list every section shares (a group's expenses, a friend's
// ledger, personal spending, the dashboard's preview): a card with the
// filters, a fixed-layout table and a "show more" link. Rows have the same
// shape everywhere: an icon tile and the description with a muted line
// under it, the date, the section's own columns, the amount and the
// edit/delete buttons. Columns hidden on narrow screens fold into the
// muted line instead.

/** The viewport width from which a column has its own cell. */
type Breakpoint = 'md' | 'lg' | 'xl' | '2xl'

// Whole class names, so Tailwind sees them.
const SHOW: Record<Breakpoint, string> = {
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
  '2xl': 'hidden 2xl:table-cell',
}
const FOLD: Record<Breakpoint, string> = {
  md: 'md:hidden',
  lg: 'lg:hidden',
  xl: 'xl:hidden',
  '2xl': '2xl:hidden',
}

export type ExpenseColumn = {
  label: string
  /** A fixed width such as `w-32`; the description takes the rest. */
  width: string
  /** Shown from this breakpoint, folded into the muted line below it. */
  from: Breakpoint
  className?: string
}

const DATE_COLUMN: ExpenseColumn = { label: 'Date', width: 'w-28', from: 'md' }

type TableLayout = { columns: Array<ExpenseColumn>; actions: boolean }
const LayoutContext = createContext<TableLayout>({ columns: [], actions: false })

/**
 * A card with an expense list: `filters` above it, then the rows (an
 * `ExpenseTable`) or `empty` when there are none. `more` is the "show
 * more" link's href, `note` a line under the card.
 */
export function ExpenseSection({
  title,
  filters,
  empty,
  more,
  note,
  children,
}: {
  title?: React.ReactNode
  filters?: React.ReactNode
  /** Shown instead of `children` when set. */
  empty?: EmptyState | false | null
  more?: string | false | null
  note?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <>
      <Card>
        {title && (
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
        )}
        <CardContent className="grid gap-4">
          {filters}
          {empty ? <ExpenseEmpty {...empty} /> : children}
        </CardContent>
      </Card>
      {more && (
        <Link
          href={more}
          scroll={false}
          className={cn(buttonVariants({ variant: 'outline' }), 'justify-self-center no-underline')}
        >
          Show more
        </Link>
      )}
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
    </>
  )
}

export type EmptyState = {
  icon: React.ReactNode
  title: React.ReactNode
  description: React.ReactNode
  /** Where "Clear filters" goes, when it's the filters that emptied the list. */
  clearHref?: string
}

function ExpenseEmpty({ icon, title, description, clearHref }: EmptyState) {
  return (
    <Empty className="py-10">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {clearHref && (
        <EmptyContent>
          <Link
            href={clearHref}
            scroll={false}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'no-underline')}
          >
            Clear filters
          </Link>
        </EmptyContent>
      )}
    </Empty>
  )
}

/**
 * The table: Description, Date, `columns`, the amount and (with `actions`)
 * a column for the row buttons. Fixed layout, so long descriptions
 * truncate instead of pushing the amounts around.
 */
export function ExpenseTable({
  columns = [],
  first = 'Description',
  amount = 'Amount',
  actions = true,
  children,
}: {
  columns?: Array<ExpenseColumn>
  first?: string
  amount?: string
  actions?: boolean
  children: React.ReactNode
}) {
  return (
    <LayoutContext value={{ columns, actions }}>
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead>{first}</TableHead>
            {[DATE_COLUMN, ...columns].map((column) => (
              <TableHead
                key={column.label}
                className={cn(SHOW[column.from], column.width, column.className)}
              >
                {column.label}
              </TableHead>
            ))}
            <TableHead className="w-32 text-right">{amount}</TableHead>
            {actions && (
              <TableHead className="w-20">
                <span className="sr-only">Actions</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>{children}</TableBody>
      </Table>
    </LayoutContext>
  )
}

/** A column's value, or the value and how it reads folded into the muted line. */
export type ExpenseCell = React.ReactNode | { value: React.ReactNode; folded: React.ReactNode }

function isSplitCell(
  cell: ExpenseCell,
): cell is { value: React.ReactNode; folded: React.ReactNode } {
  return typeof cell === 'object' && cell !== null && 'folded' in cell
}

/**
 * One row. `cells` are the values of the table's `columns`, in order; on
 * screens too narrow for a column, its value is folded into `subtitle`.
 */
export function ExpenseRow({
  icon,
  title,
  receipt,
  subtitle,
  date,
  cells = [],
  amount,
  actions,
}: {
  icon: React.ReactNode
  title: string
  /** A `ReceiptLink`, beside the title. */
  receipt?: React.ReactNode
  subtitle: React.ReactNode
  date: string
  cells?: Array<ExpenseCell>
  /** The amount; a second line (e.g. a `SignedAmount`) goes under it. */
  amount: React.ReactNode
  actions?: React.ReactNode
}) {
  const layout = use(LayoutContext)
  const folded = [
    { from: DATE_COLUMN.from, value: formatDate(date) },
    ...layout.columns.map((column, i) => {
      const cell = cells[i]
      return { from: column.from, value: isSplitCell(cell) ? cell.folded : cell }
    }),
  ]

  return (
    <TableRow>
      <TableCell className="font-medium">
        <span className="flex items-center gap-3">
          {icon}
          <span className="grid min-w-0">
            <span className="flex items-center gap-1">
              <span className="truncate" title={title}>
                {title}
              </span>
              {receipt}
            </span>
            <span className="truncate text-xs font-normal text-muted-foreground">
              {subtitle}
              {folded.map(
                ({ from, value }, i) =>
                  value != null &&
                  value !== '' && (
                    <span key={i} className={FOLD[from]}>
                      {' · '}
                      {value}
                    </span>
                  ),
              )}
            </span>
          </span>
        </span>
      </TableCell>
      <TableCell className={cn(SHOW[DATE_COLUMN.from], 'text-muted-foreground')}>
        {formatDate(date)}
      </TableCell>
      {layout.columns.map((column, i) => (
        <TableCell
          key={column.label}
          className={cn(SHOW[column.from], 'truncate text-muted-foreground', column.className)}
        >
          {isSplitCell(cells[i]) ? cells[i].value : cells[i]}
        </TableCell>
      ))}
      <TableCell className="text-right">
        <span className="grid justify-items-end font-medium tabular-nums [&>*]:max-w-full [&>*]:truncate">
          {amount}
        </span>
      </TableCell>
      {layout.actions && (
        <TableCell>
          <span className="flex justify-end gap-1">{actions}</span>
        </TableCell>
      )}
    </TableRow>
  )
}

/**
 * A row's edit and delete buttons. `edit` is a page to go to, or a form to
 * open in a dialog; deleting asks first.
 */
export function RowActions({
  name,
  edit,
  deleteDescription = 'This can’t be undone.',
  onDelete,
}: {
  /** What the row is called, for the buttons' labels. */
  name: string
  edit:
    | { href: string }
    | {
        title: string
        description?: React.ReactNode
        form: (close: () => void) => React.ReactNode
      }
  deleteDescription?: string
  onDelete: () => Promise<boolean>
}) {
  return (
    <>
      {'href' in edit ? (
        <Link
          href={edit.href}
          aria-label={`Edit ${name}`}
          title="Edit"
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
            'text-muted-foreground hover:text-foreground',
          )}
        >
          <Pencil />
        </Link>
      ) : (
        <EditDialog label={`Edit ${name}`} title={edit.title} description={edit.description}>
          {edit.form}
        </EditDialog>
      )}
      <ConfirmAction
        title={`Delete “${name}”?`}
        description={deleteDescription}
        onConfirm={onDelete}
        trigger={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${name}`}
            title="Delete"
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 />
          </Button>
        }
      />
    </>
  )
}
