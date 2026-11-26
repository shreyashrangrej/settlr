'use client'

import { useEffect, useState } from 'react'
import { useConvexAction, useConvexMutation } from '@convex-dev/react-query'
import {
  ArrowRight,
  ChevronDown,
  Plus,
  Repeat as RepeatIcon,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react'

import { CATEGORY_STYLE, groupColor, labelTint } from '#/components/category'
import { DatePicker, SelectField } from '#/components/form-fields'
import { PersonAvatar, SignedAmount, useAction } from '#/components/ledger'
import {
  ReceiptField,
  existingReceipt,
  type ReceiptValue,
  type ScannedReceipt,
} from '#/components/receipts'
import { REPEAT_HINT, type Repeat } from '#/components/repeat-select'
import { TagInput, parseTags } from '#/components/tag-input'
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
import { Input } from '#/components/ui/input'
import { Spinner } from '#/components/ui/spinner'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { errorMessage } from '#/lib/errors'
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
import {
  MAX_ITEMS,
  computeSplit,
  equalSplit,
  itemisedSplit,
  splitProblem,
  type SplitMode,
} from '@settlr/shared/split'
import { api } from '@settlr/backend/convex/_generated/api'

export type PersonalExpense = PersonalMonth['items'][number]
export type FriendExpense = Extract<FriendEntry, { kind: 'expense' }>

type FriendSplitMode = 'equal' | 'full' | 'exact'

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
 * description in one box, the category, date and repeat as chips, who paid
 * and the split (with your balance before and after), tags, the receipt
 * (which can fill the form in), and a footer with Cancel and Save (or
 * ⌘/Ctrl+Enter).
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

// How a one-on-one expense moves what the friend owes you (`friendDelta` in
// convex/lib/ledger.ts): on an equal split the payer absorbs an odd cent;
// by amount, the other one owes what was typed.
function friendEffect(expense: {
  amountCents: number
  paidBy: 'me' | 'friend'
  split: FriendSplitMode
  owedCents?: number
}) {
  const owedByOther =
    expense.split === 'equal'
      ? Math.floor(expense.amountCents / 2)
      : expense.split === 'exact'
        ? (expense.owedCents ?? 0)
        : expense.amountCents
  return expense.paidBy === 'me' ? owedByOther : -owedByOther
}

const SPLIT_MODES: Array<{ value: SplitMode; label: string; hint: string }> = [
  { value: 'equal', label: 'Equally', hint: 'Everyone ticked pays the same.' },
  { value: 'exact', label: 'Amounts', hint: 'Type what each person owes.' },
  { value: 'percent', label: '%', hint: 'Percentages that add up to 100.' },
  { value: 'shares', label: 'Shares', hint: 'e.g. 2 for a couple, 1 for one person.' },
  { value: 'items', label: 'Items', hint: 'Who had what on the bill.' },
]

type Item = { name: string; amount: string; memberIds: Array<string> }

// Typed values to what the server stores: cents, basis points, counts.
function numericInputs(mode: SplitMode, inputs: Record<string, string>) {
  const out: Record<string, number> = {}
  for (const [id, text] of Object.entries(inputs)) {
    if (!text.trim()) continue
    const value =
      mode === 'exact'
        ? parseAmountToCents(text)
        : mode === 'percent'
          ? Math.round(Number(text) * 100)
          : Math.round(Number(text))
    if (value && Number.isFinite(value) && value > 0) out[id] = value
  }
  return out
}

// What each member owes for the form's split (the server re-does this math).
function owedFor(
  mode: SplitMode,
  cents: number,
  splitAmong: Array<string>,
  inputs: Record<string, string>,
  items: Array<Item>,
  extraCents: number,
  order: Array<string>,
) {
  if (mode === 'equal') return equalSplit(cents, splitAmong, order)
  if (mode === 'items') {
    return itemisedSplit(
      items.map((item) => ({
        name: item.name,
        amountCents: parseAmountToCents(item.amount) ?? 0,
        memberIds: item.memberIds,
      })),
      extraCents,
      order,
    )
  }
  return computeSplit(mode, cents, numericInputs(mode, inputs), order)
}

// An edited expense's split, back in the form's typed units.
function initialInputs(split: GroupExpense['split'] | undefined) {
  if (!split?.inputs) return {}
  return Object.fromEntries(
    Object.entries(split.inputs).map(([id, n]) => [
      id,
      split.mode === 'exact' ? (n / 100).toFixed(2) : split.mode === 'percent' ? String(n / 100) : String(n),
    ]),
  )
}

// "-5.00" (a discount) or "12.50" to signed cents.
function signedCents(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return 0
  const cents = parseAmountToCents(trimmed.replace(/^-/, '')) ?? 0
  return trimmed.startsWith('-') ? -cents : cents
}

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)

function ExpenseForm({ target, onDone }: { target: ExpenseTarget; onDone: () => void }) {
  const expense = target.expense
  const editing = expense !== undefined
  const groupExpense = target.kind === 'group' ? target.expense : undefined

  const addPersonal = useConvexMutation(api.personal.add)
  const updatePersonal = useConvexMutation(api.personal.update)
  const addFriend = useConvexMutation(api.friends.addExpense)
  const updateFriend = useConvexMutation(api.friends.updateExpense)
  const addGroup = useConvexMutation(api.groups.addExpense)
  const updateGroup = useConvexMutation(api.groups.updateExpense)
  const createRecurring = useConvexMutation(api.recurring.create)
  const getRate = useConvexAction(api.fx.rate)

  const [description, setDescription] = useState(expense?.description ?? '')
  const [amount, setAmount] = useState(expense ? (expense.amountCents / 100).toFixed(2) : '')
  const [category, setCategory] = useState<Category>(expense?.category ?? 'food')
  const [date, setDate] = useState(expense?.date ?? todayIsoDate)
  const [receipt, setReceipt] = useState<ReceiptValue>(() => existingReceipt(expense?.receiptId))
  const [tags, setTags] = useState((expense?.tags ?? []).join(', '))
  const [repeat, setRepeat] = useState<Repeat>('never')
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

  // Friend: who paid, and whether it's shared, owed in full or by amount.
  const [friendPaidBy, setFriendPaidBy] = useState<'me' | 'friend'>(
    target.kind === 'friend' ? (target.expense?.paidBy ?? 'me') : 'me',
  )
  const [friendSplit, setFriendSplit] = useState<FriendSplitMode>(
    target.kind === 'friend' ? (target.expense?.split ?? 'equal') : 'equal',
  )
  const [friendOwed, setFriendOwed] = useState(
    target.kind === 'friend' && target.expense?.owedCents !== undefined
      ? (target.expense.owedCents / 100).toFixed(2)
      : '',
  )

  // Group: who paid, how it's split, and whether it was paid in another
  // currency and converted.
  const order = target.kind === 'group' ? target.group.members.map((m) => m.id) : []
  const [groupPaidBy, setGroupPaidBy] = useState(
    target.kind === 'group' ? (target.expense?.paidBy ?? target.group.meMemberId) : '',
  )
  const [mode, setMode] = useState<SplitMode>(groupExpense?.split?.mode ?? 'equal')
  const [splitAmong, setSplitAmong] = useState<Array<string>>(
    () => groupExpense?.splitAmong ?? order,
  )
  const [inputs, setInputs] = useState<Record<string, string>>(() =>
    initialInputs(groupExpense?.split),
  )
  const [items, setItems] = useState<Array<Item>>(
    () =>
      groupExpense?.split?.items?.map((item) => ({
        name: item.name,
        amount: (item.amountCents / 100).toFixed(2),
        memberIds: item.memberIds,
      })) ?? [{ name: '', amount: '', memberIds: order }],
  )
  const [extra, setExtra] = useState(
    groupExpense?.split?.extraCents ? (groupExpense.split.extraCents / 100).toFixed(2) : '',
  )
  const [foreign, setForeign] = useState(Boolean(groupExpense?.original))
  const [originalCurrency, setOriginalCurrency] = useState<Currency>(
    groupExpense?.original?.currency ?? (currency === 'USD' ? 'EUR' : 'USD'),
  )
  const [originalAmount, setOriginalAmount] = useState(
    groupExpense?.original ? (groupExpense.original.amountCents / 100).toFixed(2) : '',
  )
  const [rate, setRate] = useState(groupExpense?.original ? String(groupExpense.original.rate) : '')
  const [rateBusy, setRateBusy] = useState(false)

  // The amount: typed, or for a group converted from another currency or
  // added up from the bill's items.
  const extraCents = signedCents(extra)
  const itemsTotal = items.reduce((acc, item) => acc + (parseAmountToCents(item.amount) ?? 0), 0)
  const originalCents = parseAmountToCents(originalAmount) ?? 0
  const rateValue = Number(rate)
  const isItems = target.kind === 'group' && mode === 'items'
  const isForeign = target.kind === 'group' && foreign && !isItems
  const cents = isItems
    ? itemsTotal + extraCents
    : isForeign
      ? Number.isFinite(rateValue) && rateValue > 0
        ? Math.round(originalCents * rateValue)
        : 0
      : (parseAmountToCents(amount) ?? 0)

  const owed = owedFor(mode, cents, splitAmong, inputs, items, extraCents, order)
  const participants = order.filter((id) => owed.has(id))

  const { run, pending, error, setError } = useAction(
    async () => {
      const receiptId = receipt?.id
      const tagList = parseTags(tags)
      if (target.kind === 'personal') {
        const input = personalExpenseInput.parse({
          description,
          amountCents: cents,
          currency,
          category,
          date,
          tags: tagList,
        })
        if (target.expense) {
          return updatePersonal({ expenseId: target.expense.id, ...input, receiptId: receiptId ?? null })
        }
        if (repeat !== 'never') {
          // The first one is added on its date (today's right away).
          return createRecurring({
            kind: 'personal',
            description: input.description,
            amountCents: input.amountCents,
            currency: input.currency,
            category: input.category,
            frequency: repeat,
            startDate: input.date,
          })
        }
        return addPersonal({ ...input, receiptId })
      }
      if (target.kind === 'friend') {
        const input = friendExpenseInput.parse({
          description,
          amountCents: cents,
          currency,
          category,
          paidBy: friendPaidBy,
          split: friendSplit,
          owedCents: friendSplit === 'exact' ? parseAmountToCents(friendOwed || '0') : undefined,
          date,
          tags: tagList,
        })
        if (target.expense) {
          return updateFriend({ entryId: target.expense.id, ...input, receiptId: receiptId ?? null })
        }
        if (repeat !== 'never') {
          return createRecurring({
            kind: 'friend',
            friendId: target.friend.id,
            description: input.description,
            amountCents: input.amountCents,
            currency: input.currency,
            category: input.category,
            paidBy: input.paidBy,
            split: input.split === 'full' ? 'full' : 'equal',
            frequency: repeat,
            startDate: input.date,
          })
        }
        return addFriend({ friendId: target.friend.id, ...input, receiptId })
      }
      const base = {
        description,
        amountCents: cents,
        paidBy: groupPaidBy,
        splitAmong: mode === 'equal' ? splitAmong : participants,
        category,
        date,
        tags: tagList,
      }
      const split =
        mode === 'equal'
          ? undefined
          : mode === 'items'
            ? {
                mode,
                items: items.map((item) => ({
                  name: item.name.trim() || 'Item',
                  amountCents: parseAmountToCents(item.amount) ?? 0,
                  memberIds: item.memberIds,
                })),
                extraCents: extraCents || undefined,
              }
            : { mode, inputs: numericInputs(mode, inputs) }
      const original = isForeign
        ? { amountCents: originalCents, currency: originalCurrency, rate: rateValue }
        : undefined
      if (target.expense) {
        return updateGroup({
          expenseId: target.expense.id,
          ...base,
          split,
          original,
          receiptId: receiptId ?? null,
        })
      }
      if (repeat !== 'never') {
        return createRecurring({
          kind: 'group',
          groupId: target.group.id,
          description: base.description,
          amountCents: base.amountCents,
          currency: target.group.currency,
          category,
          paidBy: groupPaidBy,
          splitAmong: base.splitAmong,
          frequency: repeat,
          startDate: date,
        })
      }
      return addGroup({ groupId: target.group.id, ...base, split, original, receiptId })
    },
    {
      success: editing
        ? 'Expense updated'
        : repeat !== 'never'
          ? 'Repeating expense set up'
          : 'Expense added',
    },
  )

  async function fetchRate() {
    setRateBusy(true)
    try {
      const result = await getRate({ from: originalCurrency, to: currency, date })
      setRate(String(Number(result.rate.toFixed(6))))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setRateBusy(false)
    }
  }

  function fillFromReceipt(scanned: ScannedReceipt) {
    if (scanned.description && !description) setDescription(scanned.description)
    if (scanned.category) setCategory(scanned.category)
    if (scanned.date) setDate(scanned.date)
    if (!scanned.amountCents) return
    const typed = (scanned.amountCents / 100).toFixed(2)
    if (target.kind !== 'group') {
      setAmount(typed)
      if (scanned.currency) setCurrency(scanned.currency)
    } else if (scanned.currency && scanned.currency !== currency) {
      setForeign(true)
      setOriginalCurrency(scanned.currency)
      setOriginalAmount(typed)
    } else {
      setForeign(false)
      setAmount(typed)
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    // Check here first, so the message is the form's own (the same limits
    // the Convex mutations check).
    if (cents <= 0) {
      setError(
        isItems
          ? 'Add the bill’s items with their prices'
          : isForeign
            ? 'Enter the amount paid and the exchange rate'
            : 'Enter an amount like 12.50',
      )
      return
    }
    const parsed = personalExpenseInput.safeParse({
      description,
      amountCents: cents,
      currency,
      category,
      date,
      tags: parseTags(tags),
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form')
      return
    }
    if (target.kind === 'friend' && friendSplit === 'exact') {
      const owedCents = parseAmountToCents(friendOwed || '0')
      if (owedCents === null || owedCents > cents) {
        const other = friendPaidBy === 'me' ? `${target.friend.name} owes` : 'you owe'
        setError(`Enter what ${other}, up to the amount`)
        return
      }
      if (repeat !== 'never') {
        setError('Repeating expenses are split equally or owed in full.')
        return
      }
    }
    if (target.kind === 'group') {
      const checked = addExpenseInput.safeParse({
        description,
        amountCents: cents,
        paidBy: groupPaidBy,
        splitAmong: participants.length ? participants : splitAmong,
        category,
        date,
        tags: parseTags(tags),
      })
      if (!checked.success) {
        setError(checked.error.issues[0]?.message ?? 'Check the form')
        return
      }
      const problem = splitProblem(mode, cents, numericInputs(mode, inputs), owed)
      if (problem) {
        setError(problem)
        return
      }
      if (repeat !== 'never' && (mode !== 'equal' || isForeign)) {
        setError('Repeating expenses are split equally, in the group’s currency.')
        return
      }
    }
    if (!(await run())) return
    // A new personal expense saved to another month than the one on screen
    // says where it went and stays open for the next one, so it doesn't
    // look lost.
    if (
      target.kind === 'personal' &&
      !editing &&
      repeat === 'never' &&
      target.month &&
      date.slice(0, 7) !== target.month
    ) {
      setDescription('')
      setAmount('')
      setReceipt(null)
      setTags('')
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
        <div className="grid gap-2">
          <div className="rounded-xl border border-input bg-field transition-[border-color,box-shadow] duration-140 focus-within:border-ring focus-within:ring-3 focus-within:ring-primary-soft">
            <div className="flex items-center gap-2.5 px-3.5 pt-3 pb-2">
              {target.kind === 'group' && !isForeign ? (
                <span className="rounded-md border bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {currency}
                </span>
              ) : (
                <SelectField
                  aria-label={isForeign ? 'Currency paid in' : 'Currency'}
                  size="sm"
                  value={isForeign ? originalCurrency : currency}
                  onChange={isForeign ? setOriginalCurrency : setCurrency}
                  options={CURRENCIES.map((c) => ({ value: c, label: c }))}
                  className="w-auto shrink-0 font-medium"
                />
              )}
              {isItems ? (
                <span className="flex h-11 min-w-0 flex-1 items-center justify-between gap-2">
                  <span className="text-[1.875rem] leading-none font-semibold tracking-[-0.03em] tabular-nums">
                    {(cents / 100).toFixed(2)}
                  </span>
                  <span className="text-xs text-faint">From the items</span>
                </span>
              ) : (
                <input
                  aria-label={isForeign ? 'Amount paid' : 'Amount'}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.00"
                  value={isForeign ? originalAmount : amount}
                  // Gr8r puts the cursor in the main field, editing or not.
                  autoFocus
                  onChange={(e) =>
                    isForeign ? setOriginalAmount(e.target.value) : setAmount(e.target.value)
                  }
                  className="h-11 min-w-0 flex-1 border-0 bg-transparent text-[1.875rem] leading-none font-semibold tracking-[-0.03em] tabular-nums outline-none placeholder:text-dim"
                />
              )}
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
          {target.kind === 'group' && !isItems && (
            <label
              htmlFor="expense-foreign"
              className="flex w-fit cursor-pointer items-center gap-2 text-xs text-muted-foreground"
            >
              <Checkbox
                id="expense-foreign"
                checked={foreign}
                onCheckedChange={(checked) => {
                  setForeign(Boolean(checked))
                  if (checked && !originalAmount && amount) setOriginalAmount(amount)
                }}
              />
              Paid in another currency
            </label>
          )}
          {isForeign && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-tile px-3 py-2 text-sm">
              <label htmlFor="expense-rate" className="text-muted-foreground">
                1 {originalCurrency} =
              </label>
              <Input
                id="expense-rate"
                inputMode="decimal"
                placeholder="rate"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="w-24 tabular-nums"
              />
              <span className="text-muted-foreground">{currency}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={rateBusy}
                onClick={() => void fetchRate()}
              >
                {rateBusy && <Spinner />}
                Get rate
              </Button>
              <span className="ml-auto font-medium tabular-nums">= {formatMoney(cents, currency)}</span>
            </div>
          )}
        </div>

        {/* Gr8r's property chips. */}
        <div className="grid gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <CategoryChip value={category} onChange={setCategory} />
            <DatePicker aria-label="Date" value={date} onChange={setDate} variant="chip" />
            {!editing && <RepeatChip value={repeat} onChange={setRepeat} />}
          </div>
          {repeat !== 'never' && <p className="text-xs text-faint">{REPEAT_HINT}</p>}
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
            owed={friendOwed}
            onOwed={setFriendOwed}
          />
        )}
        {target.kind === 'group' && (
          <GroupSplit
            group={target.group}
            expense={target.expense}
            cents={cents}
            paidBy={groupPaidBy}
            onPaidBy={setGroupPaidBy}
            mode={mode}
            onMode={setMode}
            splitAmong={splitAmong}
            onSplitAmong={setSplitAmong}
            inputs={inputs}
            onInput={(id, value) => setInputs((current) => ({ ...current, [id]: value }))}
            items={items}
            onItems={setItems}
            extra={extra}
            onExtra={setExtra}
            owed={owed}
          />
        )}

        <div className="grid gap-2">
          <label htmlFor="expense-tags" className="flex items-baseline justify-between gap-2 text-sm font-medium">
            Tags
            <span className="text-xs font-normal text-faint">Optional, separated by commas</span>
          </label>
          <TagInput id="expense-tags" value={tags} onChange={setTags} />
        </div>

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
          <ReceiptField
            id="expense-receipt"
            value={receipt}
            onChange={setReceipt}
            onScan={fillFromReceipt}
          />
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

const REPEATS: Array<{ value: Repeat; label: string }> = [
  { value: 'never', label: 'Doesn’t repeat' },
  { value: 'weekly', label: 'Every week' },
  { value: 'monthly', label: 'Every month' },
  { value: 'yearly', label: 'Every year' },
]

/** Whether a new expense repeats, as a chip that opens a menu. */
function RepeatChip({ value, onChange }: { value: Repeat; onChange: (value: Repeat) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(chip, value === 'never' && 'text-muted-foreground')}
            aria-label="Repeats"
          />
        }
      >
        <RepeatIcon className={value === 'never' ? 'text-faint' : 'text-primary'} />
        {REPEATS.find((r) => r.value === value)?.label}
        <ChevronDown className="text-faint" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuRadioGroup value={value} onValueChange={(next: Repeat) => onChange(next)}>
          {REPEATS.map((r) => (
            <DropdownMenuRadioItem key={r.value} value={r.value}>
              {r.label}
            </DropdownMenuRadioItem>
          ))}
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

/** One on one: who paid (segmented), then shared, owed in full, or by amount. */
function FriendSplit({
  friend,
  expense,
  currency,
  cents,
  paidBy,
  onPaidBy,
  split,
  onSplit,
  owed,
  onOwed,
}: {
  friend: Friend
  expense?: FriendExpense
  currency: Currency
  cents: number
  paidBy: 'me' | 'friend'
  onPaidBy: (value: 'me' | 'friend') => void
  split: FriendSplitMode
  onSplit: (value: FriendSplitMode) => void
  owed: string
  onOwed: (value: string) => void
}) {
  const other = paidBy === 'me' ? friend.name : 'You'
  const owedCents = parseAmountToCents(owed || '0') ?? 0
  const effect = friendEffect({ amountCents: cents, paidBy, split, owedCents })
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
        <Tabs value={split} onValueChange={(value: FriendSplitMode) => onSplit(value)}>
          <TabsList aria-label="Split">
            <TabsTrigger value="equal">Equally</TabsTrigger>
            <TabsTrigger value="full" className="max-w-44">
              <span className="truncate">
                {other} owe{other === 'You' ? '' : 's'} all
              </span>
            </TabsTrigger>
            <TabsTrigger value="exact">By amount</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {split === 'exact' && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
          <label htmlFor="expense-owed" className="grid gap-0.5">
            <span className="text-sm font-medium">{other === 'You' ? 'You owe' : `${other} owes`}</span>
            <span className="text-xs text-faint">
              The rest is {paidBy === 'me' ? 'your' : `${friend.name}’s`} own share.
            </span>
          </label>
          <Input
            id="expense-owed"
            inputMode="decimal"
            placeholder="0.00"
            value={owed}
            onChange={(e) => onOwed(e.target.value)}
            className="w-28 text-right tabular-nums"
          />
        </div>
      )}
      <BalancePreview
        label={`Your balance with ${friend.name}`}
        before={current}
        after={without + effect}
        currency={currency}
      />
    </section>
  )
}

/**
 * A group: who paid (a chip), how it's split (equally, by amount,
 * percentage, shares or the bill's items), then everyone with their share.
 */
function GroupSplit({
  group,
  expense,
  cents,
  paidBy,
  onPaidBy,
  mode,
  onMode,
  splitAmong,
  onSplitAmong,
  inputs,
  onInput,
  items,
  onItems,
  extra,
  onExtra,
  owed,
}: {
  group: Group
  expense?: GroupExpense
  cents: number
  paidBy: string
  onPaidBy: (value: string) => void
  mode: SplitMode
  onMode: (value: SplitMode) => void
  splitAmong: Array<string>
  onSplitAmong: React.Dispatch<React.SetStateAction<Array<string>>>
  inputs: Record<string, string>
  onInput: (id: string, value: string) => void
  items: Array<Item>
  onItems: (items: Array<Item>) => void
  extra: string
  onExtra: (value: string) => void
  owed: Map<string, number>
}) {
  const me = group.meMemberId
  const order = group.members.map((m) => m.id)
  const everyone = splitAmong.length === group.members.length
  const sumOwed = [...owed.values()].reduce((a, b) => a + b, 0)
  const percentTotal =
    mode === 'percent'
      ? Object.values(numericInputs('percent', inputs)).reduce((a, b) => a + b, 0) / 100
      : 0
  // What this expense does to your balance: what you paid minus your share
  // (an edited one's old effect comes out first).
  const balanceNow = group.members.find((m) => m.id === me)?.netCents ?? 0
  const oldEffect = expense
    ? (expense.paidBy === me ? expense.amountCents : 0) - (expense.owed[me] ?? 0)
    : 0
  const balanceAfter =
    balanceNow - oldEffect + (paidBy === me ? cents : 0) - (owed.get(me) ?? 0)
  const balanced = mode === 'percent' ? percentTotal === 100 && sumOwed === cents : sumOwed === cents

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
        {mode === 'equal' && !everyone && (
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

      <div className="grid gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionLabel>Split</SectionLabel>
          <Tabs value={mode} onValueChange={(value: SplitMode) => onMode(value)}>
            <TabsList aria-label="Split">
              {SPLIT_MODES.map((m) => (
                <TabsTrigger key={m.value} value={m.value}>
                  {m.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <p className="text-xs text-faint">{SPLIT_MODES.find((m) => m.value === mode)?.hint}</p>
      </div>

      {mode === 'items' && (
        <ItemsEditor group={group} items={items} onChange={onItems} extra={extra} onExtra={onExtra} />
      )}

      {/* Gr8r's member list: a bordered box of rows with hairlines. With
          items, it's what each person's items come to. */}
      {(mode !== 'items' || owed.size > 0) && (
        <div className="overflow-hidden rounded-xl border">
          {group.members.map((m) => {
            const included = mode === 'equal' ? splitAmong.includes(m.id) : owed.has(m.id)
            const name = m.id === me ? 'You' : m.name
            const row =
              'flex min-h-11 items-center gap-2.5 border-b px-3 py-1.5 last:border-b-0'
            const who = (
              <>
                <PersonAvatar name={m.name} me={m.id === me} size="sm" />
                <span className={cn('grid min-w-0 flex-1', !included && 'opacity-55')}>
                  <span className="truncate text-sm font-medium">{name}</span>
                  {m.id === paidBy && (
                    <span className="truncate text-xs text-faint">
                      {cents ? `Paid ${formatMoney(cents, group.currency)}` : 'Paying'}
                    </span>
                  )}
                </span>
              </>
            )
            const share = (
              <span
                className={cn(
                  'min-w-16 text-right text-sm tabular-nums',
                  included ? 'font-medium' : 'text-faint',
                )}
              >
                {included ? formatMoney(owed.get(m.id) ?? 0, group.currency) : 'Not in it'}
              </span>
            )
            if (mode === 'equal') {
              return (
                <label
                  key={m.id}
                  htmlFor={`split-${m.id}`}
                  className={cn(row, 'cursor-pointer transition-colors duration-140 hover:bg-muted/60')}
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
                  {who}
                  {share}
                </label>
              )
            }
            if (mode === 'items') {
              // The bill's items decide the shares; this is just the result.
              return included ? (
                <div key={m.id} className={row}>
                  {who}
                  {share}
                </div>
              ) : null
            }
            return (
              <div key={m.id} className={row}>
                {who}
                <span className="flex items-center gap-1">
                  <Input
                    id={`split-${m.id}`}
                    aria-label={`${name}: ${mode === 'exact' ? 'amount' : mode === 'percent' ? 'percentage' : 'shares'}`}
                    inputMode="decimal"
                    value={inputs[m.id] ?? ''}
                    placeholder={mode === 'exact' ? '0.00' : '0'}
                    onChange={(e) => onInput(m.id, e.target.value)}
                    className="w-20 text-right tabular-nums"
                  />
                  {mode === 'percent' && <span className="text-xs text-faint">%</span>}
                </span>
                {share}
              </div>
            )
          })}
        </div>
      )}
      <p className={cn('-mt-1 text-xs', mode === 'equal' || balanced ? 'text-faint' : 'text-warning')}>
        {mode === 'equal'
          ? splitAmong.length === 0
            ? 'Pick at least one person.'
            : `Split equally, ${plural(splitAmong.length, 'way')}.`
          : mode === 'percent'
            ? `${percentTotal}% of 100% split so far.`
            : `${formatMoney(sumOwed, group.currency)} of ${formatMoney(cents, group.currency)} split so far.`}
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

/** The lines of an itemised bill, each with who had it, plus tax and tip. */
function ItemsEditor({
  group,
  items,
  onChange,
  extra,
  onExtra,
}: {
  group: Group
  items: Array<Item>
  onChange: (items: Array<Item>) => void
  extra: string
  onExtra: (value: string) => void
}) {
  const update = (i: number, patch: Partial<Item>) =>
    onChange(items.map((item, n) => (n === i ? { ...item, ...patch } : item)))
  const order = group.members.map((m) => m.id)
  return (
    <div className="grid gap-2">
      <div className="overflow-hidden rounded-xl border">
        {items.map((item, i) => (
          <div key={i} className="grid gap-2 border-b px-3 py-2.5 last:border-b-0">
            <div className="flex gap-2">
              <Input
                aria-label={`Item ${i + 1} name`}
                placeholder="Item"
                value={item.name}
                maxLength={60}
                onChange={(e) => update(i, { name: e.target.value })}
              />
              <Input
                aria-label={`Item ${i + 1} price`}
                inputMode="decimal"
                placeholder="0.00"
                value={item.amount}
                onChange={(e) => update(i, { amount: e.target.value })}
                className="w-24 shrink-0 text-right tabular-nums"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove item ${i + 1}`}
                disabled={items.length === 1}
                onClick={() => onChange(items.filter((_, n) => n !== i))}
              >
                <Trash2 />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {group.members.map((m) => {
                const on = item.memberIds.includes(m.id)
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      update(i, {
                        memberIds: on
                          ? item.memberIds.filter((id) => id !== m.id)
                          : order.filter((id) => id === m.id || item.memberIds.includes(id)),
                      })
                    }
                    className={cn(
                      'rounded-md border px-2 py-0.5 text-xs transition-colors duration-140',
                      on ? 'border-primary bg-primary-soft text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {m.id === group.meMemberId ? 'You' : m.name}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={items.length >= MAX_ITEMS}
          onClick={() => onChange([...items, { name: '', amount: '', memberIds: order }])}
        >
          <Plus />
          Add item
        </Button>
        <span className="flex items-center gap-2 text-sm">
          <label htmlFor="expense-extra" className="text-xs text-muted-foreground">
            Tax, tip, service (− for a discount)
          </label>
          <Input
            id="expense-extra"
            inputMode="decimal"
            placeholder="0.00"
            value={extra}
            onChange={(e) => onExtra(e.target.value)}
            className="w-24 text-right tabular-nums"
          />
        </span>
      </div>
    </div>
  )
}
