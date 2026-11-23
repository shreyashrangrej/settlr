'use client'

import { createContext, use, useState } from 'react'
import Link from 'next/link'
import { Ellipsis, Pencil, Trash2 } from 'lucide-react'

import { ConfirmAction } from '#/components/confirm-action'
import { EditDialog } from '#/components/edit-dialog'
import { useAppRouter } from '#/components/navigation-progress'
import { Button, buttonVariants } from '#/components/ui/button'
import { Card, CardHeader, CardTitle } from '#/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
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
// ledger, personal spending, the dashboard's preview), laid out like Gr8r
// Studio's members table: the filter bar above a card, the table edge to
// edge inside it, and a "show more" link. Rows have the same shape
// everywhere: an icon tile and the description with a faint line under
// it, the date, the section's own columns, the amount and a "⋯" menu with
// Edit and Delete. Columns hidden on narrow screens fold into the faint
// line instead.

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
 * An expense list: `filters` above a card holding the rows (an
 * `ExpenseTable`, flush to its edges) or `empty` when there are none.
 * `more` is the "show more" link's href, `note` a line under the card.
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
      <div className="grid gap-3">
        {filters}
        <Card className="gap-0 py-0">
          {title && (
            <CardHeader className="border-b border-divider pt-3 pb-2.5">
              <CardTitle>{title}</CardTitle>
            </CardHeader>
          )}
          {empty ? <ExpenseEmpty {...empty} /> : children}
        </Card>
      </div>
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
    <Empty className="py-12">
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
              <TableHead key={column.label} className={cn(SHOW[column.from], column.width)}>
                {column.label}
              </TableHead>
            ))}
            <TableHead className="w-32 text-right">{amount}</TableHead>
            {actions && (
              <TableHead className="w-12">
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
        <span className="flex items-center gap-2.5">
          {icon}
          <span className="grid min-w-0">
            <span className="flex items-center gap-1">
              <span className="truncate" title={title}>
                {title}
              </span>
              {receipt}
            </span>
            <span className="truncate text-xs font-normal text-faint">
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
        <TableCell className="pl-0">
          <span className="flex justify-end">{actions}</span>
        </TableCell>
      )}
    </TableRow>
  )
}

/**
 * A row's "⋯" menu (Gr8r's row options) with Edit and Delete. `edit` is a
 * page to go to, or a form to open in a dialog; deleting asks first.
 */
export function RowActions({
  name,
  edit,
  deleteDescription = 'This can’t be undone.',
  onDelete,
}: {
  /** What the row is called, for the menu's label and the dialogs. */
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
  const router = useAppRouter()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Options for ${name}`}
              title="Options"
            />
          }
        >
          <Ellipsis />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuItem
            onClick={() => ('href' in edit ? router.push(edit.href) : setEditing(true))}
          >
            <Pencil />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setDeleting(true)}>
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {!('href' in edit) && (
        <EditDialog
          open={editing}
          onOpenChange={setEditing}
          title={edit.title}
          description={edit.description}
        >
          {edit.form}
        </EditDialog>
      )}
      <ConfirmAction
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete “${name}”?`}
        description={deleteDescription}
        onConfirm={onDelete}
      />
    </>
  )
}
