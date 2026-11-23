'use client'

import { useEffect, useState } from 'react'
import { useConvexMutation } from '@convex-dev/react-query'
import { ArrowRight, ChevronDown, Users, Wallet } from 'lucide-react'

import { CATEGORY_STYLE, groupColor, labelTint } from '#/components/category'
import { DatePicker, SelectField } from '#/components/form-fields'
import { PersonAvatar, SignedAmount, useAction } from '#/components/ledger'
import { ReceiptField, existingReceipt, type ReceiptValue } from '#/components/receipts'
import { Button } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { FieldError } from '#/components/ui/field'
import { Spinner } from '#/components/ui/spinner'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { readPreferences } from '#/lib/preferences'
import type { Friend, FriendEntry, Group, GroupExpense, PersonalMonth } from '#/lib/types'
import { cn } from '#/lib/utils'
import {
  categoryLabel,
  formatMoney,
  formatMonth,
  memberName,
  parseAmountToCents,
  plural,
  todayIsoDate,
} from '@settlr/shared/format'
import {
  CATEGORIES,
  CURRENCIES,
  addExpenseInput,
  friendExpenseInput,
  personalExpenseInput,
  type Category,
  type Currency,
} from '@settlr/shared/schemas'
import { api } from '@settlr/backend/convex/_generated/api'

export type PersonalExpense = PersonalMonth['items'][number]
export type FriendExpense = Extract<FriendEntry, { kind: 'expense' }>

/**
 * Where an expense lives, and the expense when editing one: just yours, one
 * on one with a friend, or in a group. The form is the same for all three;
 * only who paid and how it's split differ.
 */
export type ExpenseTarget =
  | {
      kind: 'personal'
      expense?: PersonalExpense
      /** The month on screen, so a new expense saved to another one can say where it went. */
      month?: string
    }
  | { kind: 'friend'; friend: Friend; expense?: FriendExpense }
  | { kind: 'group'; group: Group; expense?: GroupExpense }

/**
 * Adding or editing an expense, anywhere: Gr8r Studio's task modal. A
 * header with what it is and where it lives, then the amount and
 * description in one box, the category and date as chips, who paid and the
 * split (with your balance before and after), the receipt, and a footer
 * with Cancel and Save (or ⌘/Ctrl+Enter).
 *
 * Opened by `trigger` (a Base UI `render` element, e.g. the header's "Add
 * expense" Button, with `children` as its content), or controlled with
 * `open`/`onOpenChange` (a row's "⋯" menu). The form mounts on open, so it
 * always starts from the expense's current values.
 */
export function ExpenseDialog({
  target,
  trigger,
  children,
  open: controlledOpen,
  onOpenChange,
}: {
  target: ExpenseTarget
  trigger?: React.ReactElement
  children?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [ownOpen, setOwnOpen] = useState(false)
  const controlled = controlledOpen !== undefined
  const open = controlled ? controlledOpen : ownOpen
  const setOpen = (next: boolean) => (controlled ? onOpenChange?.(next) : setOwnOpen(next))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger render={trigger}>{children}</DialogTrigger>}
      {/* Gr8r's modal: 560px, header / scrolling body / footer, so the
          buttons stay in view on a long group. */}
      <DialogContent className="flex flex-col gap-0 overflow-hidden p-0 sm:max-w-140">
        <ExpenseForm target={target} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

// A friend's expenses start in a currency you already have a balance with
// them in, else the one picked in Settings (read after hydration).
export function useFriendCurrency(friend: Friend, initial?: Currency) {
  const fromBalance = Object.keys(friend.balances)[0] as Currency | undefined
  const [currency, setCurrency] = useState<Currency>(initial ?? fromBalance ?? 'USD')
  useEffect(() => {
    if (!initial && !fromBalance) setCurrency(readPreferences().defaultCurrency)
  }, [initial, fromBalance])
  return [currency, setCurrency] as const
}

// Each participant's share of a group expense, split the way the server
// does it (convex/lib/ledger.ts): leftover cents go to the first ones in
// member order.
function groupShares(amountCents: number, splitAmong: Array<string>, order: Array<string>) {
  const participants = order.filter((id) => splitAmong.includes(id))
  const result = new Map<string, number>()
  if (participants.length === 0) return result
  const base = Math.floor(amountCents / participants.length)
  const remainder = amountCents - base * participants.length
  participants.forEach((id, i) => result.set(id, base + (i < remainder ? 1 : 0)))
  return result
}

// How a group expense moves one member's balance: what they paid minus their share.
function groupEffect(
  memberId: string,
  expense: { amountCents: number; paidBy: string; splitAmong: Array<string> },
  order: Array<string>,
) {
  const share = groupShares(expense.amountCents, expense.splitAmong, order).get(memberId) ?? 0
  return (expense.paidBy === memberId ? expense.amountCents : 0) - share
}

// How a one-on-one expense moves what the friend owes you (`friendDelta` in
// convex/lib/ledger.ts): on an equal split the payer absorbs an odd cent.
function friendEffect(expense: { amountCents: number; paidBy: 'me' | 'friend'; split: 'equal' | 'full' }) {
  const owedByOther =
    expense.split === 'equal' ? Math.floor(expense.amountCents / 2) : expense.amountCents
  return expense.paidBy === 'me' ? owedByOther : -owedByOther
}

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)

function ExpenseForm({ target, onDone }: { target: ExpenseTarget; onDone: () => void }) {
  const expense = target.expense
  const editing = expense !== undefined

  const addPersonal = useConvexMutation(api.personal.add)
  const updatePersonal = useConvexMutation(api.personal.update)
  const addFriend = useConvexMutation(api.friends.addExpense)
  const updateFriend = useConvexMutation(api.friends.updateExpense)
  const addGroup = useConvexMutation(api.groups.addExpense)
  const updateGroup = useConvexMutation(api.groups.updateExpense)

  const [description, setDescription] = useState(expense?.description ?? '')
  const [amount, setAmount] = useState(expense ? (expense.amountCents / 100).toFixed(2) : '')
  const [category, setCategory] = useState<Category>(expense?.category ?? 'food')
  const [date, setDate] = useState(expense?.date ?? todayIsoDate)
  const [receipt, setReceipt] = useState<ReceiptValue>(() => existingReceipt(expense?.receiptId))
  const [savedTo, setSavedTo] = useState<string | null>(null)

  // Personal and friend expenses pick a currency; a group's is fixed.
  const [personalCurrency, setPersonalCurrency] = useState<Currency>(
    target.kind === 'personal' && target.expense ? target.expense.currency : 'USD',
  )
  useEffect(() => {
    if (target.kind === 'personal' && !target.expense) {
      setPersonalCurrency(readPreferences().defaultCurrency)
    }
  }, [target.kind, target.expense])
  const [friendCurrency, setFriendCurrency] = useFriendCurrency(
    target.kind === 'friend' ? target.friend : ({ balances: {} } as Friend),
    target.kind === 'friend' ? target.expense?.currency : undefined,
  )
  const currency: Currency =
    target.kind === 'group'
      ? target.group.currency
      : target.kind === 'friend'
        ? friendCurrency
        : personalCurrency
  const setCurrency = target.kind === 'friend' ? setFriendCurrency : setPersonalCurrency

  // Friend: who paid, and whether it's shared or owed in full.
  const [friendPaidBy, setFriendPaidBy] = useState<'me' | 'friend'>(
    target.kind === 'friend' ? (target.expense?.paidBy ?? 'me') : 'me',
  )
  const [friendSplit, setFriendSplit] = useState<'equal' | 'full'>(
    target.kind === 'friend' ? (target.expense?.split ?? 'equal') : 'equal',
  )

  // Group: who paid, and who it's split between.
  const [groupPaidBy, setGroupPaidBy] = useState(
    target.kind === 'group' ? (target.expense?.paidBy ?? target.group.meMemberId) : '',
  )
  const [splitAmong, setSplitAmong] = useState<Array<string>>(() =>
    target.kind === 'group'
      ? (target.expense?.splitAmong ?? target.group.members.map((m) => m.id))
      : [],
  )

  const cents = parseAmountToCents(amount) ?? 0

  const { run, pending, error, setError } = useAction(
    async () => {
      const amountCents = parseAmountToCents(amount)
      if (amountCents === null) throw new Error('Enter an amount like 12.50')
      const receiptId = receipt?.id
      if (target.kind === 'personal') {
        const input = personalExpenseInput.parse({ description, amountCents, currency, category, date })
        return target.expense
          ? updatePersonal({ expenseId: target.expense.id, ...input, receiptId: receiptId ?? null })
          : addPersonal({ ...input, receiptId })
      }
      if (target.kind === 'friend') {
        const input = friendExpenseInput.parse({
          description,
          amountCents,
          currency,
          category,
          paidBy: friendPaidBy,
          split: friendSplit,
          date,
        })
        return target.expense
          ? updateFriend({ entryId: target.expense.id, ...input, receiptId: receiptId ?? null })
          : addFriend({ friendId: target.friend.id, ...input, receiptId })
      }
      const input = addExpenseInput.parse({
        description,
        amountCents,
        paidBy: groupPaidBy,
        splitAmong,
        category,
        date,
      })
      return target.expense
        ? updateGroup({ expenseId: target.expense.id, ...input, receiptId: receiptId ?? null })
        : addGroup({ groupId: target.group.id, ...input, receiptId })
    },
    { success: editing ? 'Expense updated' : 'Expense added' },
  )

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    // Check here first, so the message is the form's own (the same limits
    // the Convex mutations check).
    if (parseAmountToCents(amount) === null) {
      setError('Enter an amount like 12.50')
      return
    }
    const parsed = personalExpenseInput.safeParse({ description, amountCents: cents, currency, category, date })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form')
      return
    }
    if (target.kind === 'group' && splitAmong.length === 0) {
      setError('Split between at least one person')
      return
    }
    if (!(await run())) return
    // A new personal expense saved to another month than the one on screen
    // says where it went and stays open for the next one, so it doesn't
    // look lost.
    if (target.kind === 'personal' && !editing && target.month && date.slice(0, 7) !== target.month) {
      setDescription('')
      setAmount('')
      setReceipt(null)
      setSavedTo(formatMonth(date.slice(0, 7)))
      return
    }
    onDone()
  }

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault()
          event.currentTarget.requestSubmit()
        }
      }}
      className="flex min-h-0 flex-col"
    >
      <header className="grid gap-1 px-4 pt-3.5 pr-12">
        <DialogTitle>{editing ? 'Edit expense' : 'Add expense'}</DialogTitle>
        <DialogDescription className="flex min-w-0 items-center gap-1.5 text-xs">
          <TargetLine target={target} />
        </DialogDescription>
      </header>

      <div className="flex min-h-0 flex-col gap-3.5 overflow-y-auto px-4 pt-3.5 pb-4">
        {/* The amount and what it was for, in one box (Gr8r's large title
            input over its description). */}
        <div className="rounded-xl border border-input bg-field transition-[border-color,box-shadow] duration-140 focus-within:border-ring focus-within:ring-3 focus-within:ring-primary-soft">
          <div className="flex items-center gap-2.5 px-3.5 pt-3 pb-2">
            {target.kind === 'group' ? (
              <span className="rounded-md border bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                {currency}
              </span>
            ) : (
              <SelectField
                aria-label="Currency"
                size="sm"
                value={currency}
                onChange={setCurrency}
                options={CURRENCIES.map((c) => ({ value: c, label: c }))}
                className="w-auto shrink-0 font-medium"
              />
            )}
            <input
              aria-label="Amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={amount}
              // Gr8r puts the cursor in the main field, editing or not.
              autoFocus
              onChange={(e) => setAmount(e.target.value)}
              className="h-11 min-w-0 flex-1 border-0 bg-transparent text-[1.875rem] leading-none font-semibold tracking-[-0.03em] tabular-nums outline-none placeholder:text-dim"
            />
          </div>
          <input
            aria-label="Description"
            value={description}
            maxLength={80}
            placeholder="What was it for?"
            onChange={(e) => setDescription(e.target.value)}
            className="h-10 w-full rounded-b-xl border-0 border-t border-divider bg-transparent px-3.5 text-[0.9375rem] font-medium outline-none placeholder:font-normal placeholder:text-faint"
          />
        </div>

        {/* Gr8r's property chips. */}
        <div className="flex flex-wrap items-center gap-1.5">
          <CategoryChip value={category} onChange={setCategory} />
          <DatePicker aria-label="Date" value={date} onChange={setDate} variant="chip" />
        </div>

        {target.kind === 'friend' && (
          <FriendSplit
            friend={target.friend}
            expense={target.expense}
            currency={currency}
            cents={cents}
            paidBy={friendPaidBy}
            onPaidBy={setFriendPaidBy}
            split={friendSplit}
            onSplit={setFriendSplit}
          />
        )}
        {target.kind === 'group' && (
          <GroupSplit
            group={target.group}
            expense={target.expense}
            cents={cents}
            paidBy={groupPaidBy}
            onPaidBy={setGroupPaidBy}
            splitAmong={splitAmong}
            onSplitAmong={setSplitAmong}
          />
        )}

        <div className="grid gap-2">
          <span className="flex items-baseline justify-between gap-2 text-sm font-medium">
            Receipt
            <span className="text-xs font-normal text-faint">
              {target.kind === 'group'
                ? 'Everyone in the group can see it'
                : target.kind === 'friend' && target.friend.status === 'linked'
                  ? `${target.friend.name} can see it`
                  : 'Optional'}
            </span>
          </span>
          <ReceiptField id="expense-receipt" value={receipt} onChange={setReceipt} />
        </div>

        {error && <FieldError>{error}</FieldError>}
      </div>

      <footer className="flex items-center gap-2 border-t px-4 py-3">
        {savedTo ? (
          <p className="min-w-0 truncate text-xs text-positive" role="status">
            Saved to {savedTo}.
          </p>
        ) : (
          <span className="hidden items-center gap-1 text-2xs text-faint sm:flex" aria-hidden="true">
            <kbd className="kbd">{isMac() ? '⌘' : 'Ctrl'}</kbd>
            <kbd className="kbd">↵</kbd>
          </span>
        )}
        <span className="flex-1" />
        <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
        <Button type="submit" disabled={pending}>
          {pending && <Spinner />}
          {editing ? 'Save changes' : 'Add expense'}
        </Button>
      </footer>
    </form>
  )
}

/** The header's second line: where the expense lives. */
function TargetLine({ target }: { target: ExpenseTarget }) {
  if (target.kind === 'personal') {
    return (
      <>
        <span className="grid size-4 shrink-0 place-items-center rounded-sm bg-primary-soft text-primary [&_svg]:size-2.5">
          <Wallet />
        </span>
        <span className="truncate">Personal · just yours, not split</span>
      </>
    )
  }
  if (target.kind === 'friend') {
    const { friend } = target
    return (
      <>
        <PersonAvatar name={friend.name} size="sm" className="data-[size=sm]:size-4 *:text-[0.4375rem]!" />
        <span className="truncate">
          With {friend.name}
          {friend.status === 'linked' &&
            (target.expense ? ' · they’ll be told about the change' : ' · they’ll see it too')}
        </span>
      </>
    )
  }
  const { group } = target
  return (
    <>
      <span
        className="grid size-4 shrink-0 place-items-center rounded-sm [&_svg]:size-2.5"
        style={labelTint(groupColor(group.id))}
      >
        <Users />
      </span>
      <span className="truncate">
        {group.name} · {group.currency} · {plural(group.members.length, 'member')}
      </span>
    </>
  )
}

const chip =
  'h-7.5 gap-1.5 px-2 font-medium sm:h-6.5 sm:px-2 [&_svg:not([class*=size-])]:size-3.5'

/** The category as a chip that opens a menu of them. */
function CategoryChip({ value, onChange }: { value: Category; onChange: (value: Category) => void }) {
  const { icon: Icon, color } = CATEGORY_STYLE[value]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button type="button" variant="outline" size="sm" className={chip} aria-label="Category" />}
      >
        <span
          aria-hidden="true"
          className="grid size-4.5 place-items-center rounded-sm [&_svg]:size-3"
          style={labelTint(color)}
        >
          <Icon />
        </span>
        {categoryLabel(value)}
        <ChevronDown className="text-faint" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuRadioGroup value={value} onValueChange={(next: Category) => onChange(next)}>
          {CATEGORIES.map((category) => {
            const style = CATEGORY_STYLE[category]
            return (
              <DropdownMenuRadioItem key={category} value={category}>
                <span
                  aria-hidden="true"
                  className="grid size-5 place-items-center rounded-md [&_svg]:size-3!"
                  style={labelTint(style.color)}
                >
                  <style.icon />
                </span>
                {categoryLabel(category)}
              </DropdownMenuRadioItem>
            )
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Your balance before and after the expense, on one line. */
function BalancePreview({
  label,
  before,
  after,
  currency,
}: {
  label: string
  before: number
  after: number
  currency: Currency
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg bg-tile px-3 py-2.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2 text-sm">
        <SignedAmount cents={before} currency={currency} className="font-normal text-muted-foreground" />
        <ArrowRight className="size-3.5 text-dim" role="img" aria-label="becomes" />
        <SignedAmount cents={after} currency={currency} />
      </span>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-sm font-medium">{children}</span>
}

/** One on one: who paid (segmented), then shared or owed in full. */
function FriendSplit({
  friend,
  expense,
  currency,
  cents,
  paidBy,
  onPaidBy,
  split,
  onSplit,
}: {
  friend: Friend
  expense?: FriendExpense
  currency: Currency
  cents: number
  paidBy: 'me' | 'friend'
  onPaidBy: (value: 'me' | 'friend') => void
  split: 'equal' | 'full'
  onSplit: (value: 'equal' | 'full') => void
}) {
  const other = paidBy === 'me' ? friend.name : 'You'
  const effect = friendEffect({ amountCents: cents, paidBy, split })
  // The balance now already includes this expense when editing it in the
  // same currency, so the new one replaces its effect rather than adding to it.
  const current = friend.balances[currency] ?? 0
  const without =
    expense && expense.currency === currency ? current - friendEffect(expense) : current
  return (
    <section className="grid gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionLabel>Paid by</SectionLabel>
        <Tabs value={paidBy} onValueChange={(value: 'me' | 'friend') => onPaidBy(value)}>
          <TabsList aria-label="Paid by">
            <TabsTrigger value="me">You</TabsTrigger>
            <TabsTrigger value="friend" className="max-w-40">
              <span className="truncate">{friend.name}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionLabel>Split</SectionLabel>
        <Tabs value={split} onValueChange={(value: 'equal' | 'full') => onSplit(value)}>
          <TabsList aria-label="Split">
            <TabsTrigger value="equal">Equally</TabsTrigger>
            <TabsTrigger value="full" className="max-w-48">
              <span className="truncate">
                {other} owe{other === 'You' ? '' : 's'} all
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <BalancePreview
        label={`Your balance with ${friend.name}`}
        before={current}
        after={without + effect}
        currency={currency}
      />
    </section>
  )
}

/** A group: who paid (a chip), then everyone with a checkbox and their share. */
function GroupSplit({
  group,
  expense,
  cents,
  paidBy,
  onPaidBy,
  splitAmong,
  onSplitAmong,
}: {
  group: Group
  expense?: GroupExpense
  cents: number
  paidBy: string
  onPaidBy: (value: string) => void
  splitAmong: Array<string>
  onSplitAmong: React.Dispatch<React.SetStateAction<Array<string>>>
}) {
  const me = group.meMemberId
  const order = group.members.map((m) => m.id)
  const shares = groupShares(cents, splitAmong, order)
  const everyone = splitAmong.length === group.members.length
  const balanceNow = group.members.find((m) => m.id === me)?.netCents ?? 0
  const balanceAfter =
    balanceNow - (expense ? groupEffect(me, expense, order) : 0) + groupEffect(me, { amountCents: cents, paidBy, splitAmong }, order)

  return (
    <section className="grid gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <SectionLabel>Paid by</SectionLabel>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button type="button" variant="outline" size="sm" className={chip} aria-label="Paid by" />}
            >
              <PersonAvatar
                name={memberName(group.members, paidBy)}
                me={paidBy === me}
                size="sm"
                className="data-[size=sm]:size-4.5 *:text-[0.5rem]!"
              />
              {paidBy === me ? 'You' : memberName(group.members, paidBy)}
              <ChevronDown className="text-faint" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuRadioGroup value={paidBy} onValueChange={(next: string) => onPaidBy(next)}>
                {group.members.map((m) => (
                  <DropdownMenuRadioItem key={m.id} value={m.id}>
                    <PersonAvatar name={m.name} me={m.id === me} size="sm" />
                    <span className="truncate">{m.id === me ? 'You' : m.name}</span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
        {!everyone && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => onSplitAmong(order)}
          >
            Select everyone
          </Button>
        )}
      </div>

      {/* Gr8r's member list: a bordered box of rows with hairlines. */}
      <div className="overflow-hidden rounded-xl border">
        {group.members.map((m) => {
          const included = splitAmong.includes(m.id)
          const name = m.id === me ? 'You' : m.name
          return (
            <label
              key={m.id}
              htmlFor={`split-${m.id}`}
              className="flex min-h-11 cursor-pointer items-center gap-2.5 border-b px-3 py-1.5 transition-colors duration-140 last:border-b-0 hover:bg-muted/60"
            >
              <Checkbox
                id={`split-${m.id}`}
                checked={included}
                onCheckedChange={(checked) =>
                  onSplitAmong((current) =>
                    checked
                      ? order.filter((id) => id === m.id || current.includes(id))
                      : current.filter((id) => id !== m.id),
                  )
                }
              />
              <PersonAvatar name={m.name} me={m.id === me} size="sm" />
              <span className={cn('grid min-w-0 flex-1', !included && 'opacity-55')}>
                <span className="truncate text-sm font-medium">{name}</span>
                {m.id === paidBy && (
                  <span className="truncate text-xs text-faint">
                    {cents ? `Paid ${formatMoney(cents, group.currency)}` : 'Paying'}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  'text-sm tabular-nums',
                  included ? 'font-medium' : 'text-faint',
                )}
              >
                {included ? formatMoney(shares.get(m.id) ?? 0, group.currency) : 'Not in it'}
              </span>
            </label>
          )
        })}
      </div>
      <p className="-mt-1 text-xs text-faint">
        {splitAmong.length === 0
          ? 'Pick at least one person.'
          : `Split equally, ${plural(splitAmong.length, 'way')}.`}
      </p>

      <BalancePreview
        label={`Your balance in ${group.name}`}
        before={balanceNow}
        after={balanceAfter}
        currency={group.currency}
      />
    </section>
  )
}
