'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { convexQuery, useConvexAction, useConvexMutation } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { SendHorizontal, Sparkles, Trash2, User, Users, Wallet } from 'lucide-react'

import { useAction } from '#/components/ledger'
import { PageHeader, SplitLayout } from '#/components/page-header'
import { Panel, Section } from '#/components/section'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '#/components/ui/empty'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '#/components/ui/item'
import { Spinner } from '#/components/ui/spinner'
import { Textarea } from '#/components/ui/textarea'
import { errorMessage } from '#/lib/errors'
import { categoryLabel, formatDate, formatMoney, plural } from '#/lib/format'
import { readPreferences } from '#/lib/preferences'
import type { AssistantExpense, ChatEvent } from '#/lib/types'
import type { Id } from '#convex/_generated/dataModel'
import { api } from '#convex/_generated/api'

const EXAMPLES = [
  'Add tea personal expense 50',
  'How much did I spend on food this month?',
  'Show my expenses with Sam',
  'Change the tea to 60',
  'Taxi 600 in the Goa trip, paid by Priya',
  'Delete yesterday’s taxi',
]
// The same limits as convex/assistant.ts.
const MAX_MESSAGE = 500
const MAX_HISTORY = 12

type Message =
  | { id: number; role: 'user'; content: string }
  | {
      id: number
      role: 'assistant'
      content: string
      events: Array<ChatEvent>
      // The expenses this reply was about, sent back as history.
      memo: string
    }
  | { id: number; role: 'error'; content: string }

// The viewer's own date, not UTC: "today" is wherever they are.
function localIsoDate() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** A chat that adds, finds and changes expenses from plain language. */
export function AssistantView() {
  const { data: status } = useSuspenseQuery(convexQuery(api.assistant.status, {}))
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  function fillExample(example: string) {
    setDraft(example)
    inputRef.current?.focus()
  }

  return (
    <>
      <PageHeader
        title="Assistant"
        description="Add, find and change expenses by saying what you want, in your own words."
      />
      <SplitLayout aside={<Tips onExample={fillExample} />}>
        <Chat
          configured={status.configured}
          draft={draft}
          setDraft={setDraft}
          inputRef={inputRef}
          onExample={fillExample}
        />
      </SplitLayout>
    </>
  )
}

function Chat({
  configured,
  draft,
  setDraft,
  inputRef,
  onExample,
}: {
  configured: boolean
  draft: string
  setDraft: (value: string) => void
  inputRef: React.RefObject<HTMLTextAreaElement | null>
  onExample: (example: string) => void
}) {
  const id = useId()
  const send = useConvexAction(api.assistant.send)
  const [messages, setMessages] = useState<Array<Message>>([])
  const [pending, setPending] = useState(false)
  const nextId = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Keep the latest message in view.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages, pending])

  async function submit() {
    const content = draft.trim()
    if (!content || pending || !configured) return
    type Turn = { role: 'user' | 'assistant'; content: string; memo?: string }
    const history = [
      ...messages.flatMap((m): Array<Turn> =>
        m.role === 'user'
          ? [{ role: 'user', content: m.content }]
          : m.role === 'assistant'
            ? [{ role: 'assistant', content: m.content, memo: m.memo || undefined }]
            : [],
      ),
      { role: 'user' as const, content },
    ].slice(-MAX_HISTORY)
    setMessages((list) => [...list, { id: nextId.current++, role: 'user', content }])
    setDraft('')
    setPending(true)
    try {
      const { reply, events, memo } = await send({
        messages: history,
        today: localIsoDate(),
        currency: readPreferences().defaultCurrency,
      })
      setMessages((list) => [
        ...list,
        { id: nextId.current++, role: 'assistant', content: reply, events, memo },
      ])
    } catch (err) {
      setMessages((list) => [
        ...list,
        { id: nextId.current++, role: 'error', content: errorMessage(err) },
      ])
    } finally {
      setPending(false)
      inputRef.current?.focus()
    }
  }

  return (
    <Panel>
      <div
        ref={scrollRef}
        className="grid h-[min(65vh,40rem)] content-start gap-3 overflow-y-auto p-4"
        aria-live="polite"
      >
        {!configured && (
          <Alert>
            <Sparkles />
            <AlertTitle>The assistant isn’t set up yet</AlertTitle>
            <AlertDescription>
              Set <code>OPENROUTER_API_KEY</code> and <code>OPENROUTER_MODEL</code> on the
              Convex deployment to turn it on.
            </AlertDescription>
          </Alert>
        )}
        {messages.length === 0 ? (
          <Empty className="self-center">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Sparkles />
              </EmptyMedia>
              <EmptyTitle>What can I do for you?</EmptyTitle>
              <EmptyDescription>
                Add an expense, ask what you spent, or change one you already have. Personal,
                friend and group expenses all work.
              </EmptyDescription>
            </EmptyHeader>
            <div className="flex flex-wrap justify-center gap-2">
              {EXAMPLES.slice(0, 2).map((example) => (
                <Button
                  key={example}
                  variant="outline"
                  size="sm"
                  onClick={() => onExample(example)}
                >
                  {example}
                </Button>
              ))}
            </div>
          </Empty>
        ) : (
          messages.map((message) => <ChatMessage key={message.id} message={message} />)
        )}
        {pending && (
          <div className="flex w-fit items-center gap-2 rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2 text-muted-foreground">
            <Spinner />
            Thinking…
          </div>
        )}
      </div>

      <form
        className="grid gap-2 border-t p-4"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <label htmlFor={`${id}-message`} className="sr-only">
          Message
        </label>
        <div className="flex items-end gap-2">
          <Textarea
            id={`${id}-message`}
            ref={inputRef}
            value={draft}
            rows={1}
            maxLength={MAX_MESSAGE}
            disabled={!configured}
            placeholder="Add tea personal expense 50"
            className="max-h-40 min-h-9 resize-none"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter adds a line.
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                void submit()
              }
            }}
          />
          <Button
            type="submit"
            size="icon-lg"
            aria-label="Send"
            disabled={!configured || pending || !draft.trim()}
          >
            <SendHorizontal />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Conversations aren’t saved. Everything it adds or changes shows up on the usual pages.
        </p>
      </form>
    </Panel>
  )
}

function ChatMessage({ message }: { message: Message }) {
  if (message.role === 'user') {
    return (
      <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 whitespace-pre-wrap text-primary-foreground">
        {message.content}
      </p>
    )
  }
  if (message.role === 'error') {
    return (
      <p className="max-w-[85%] rounded-2xl rounded-bl-sm bg-destructive/10 px-3.5 py-2 text-destructive">
        {message.content}
      </p>
    )
  }
  return (
    <div className="grid gap-2">
      <p className="w-fit max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2 whitespace-pre-wrap">
        {message.content}
      </p>
      {message.events.map((event, i) => (
        <EventCard key={i} event={event} />
      ))}
    </div>
  )
}

function EventCard({ event }: { event: ChatEvent }) {
  switch (event.type) {
    case 'added':
      return (
        <ExpenseItem
          expense={event.expense}
          variant="outline"
          badge={<Badge variant="secondary">Added</Badge>}
        />
      )
    case 'updated':
      return (
        <ExpenseItem
          expense={event.expense}
          variant="outline"
          badge={<Badge variant="secondary">Updated</Badge>}
          note={changes(event.before, event.expense)}
        />
      )
    case 'delete':
      return <DeleteOffer expense={event.expense} />
    case 'found':
      return <FoundList event={event} />
  }
}

// What an edit changed, e.g. "Amount ₹50.00 → ₹60.00".
function changes(before: AssistantExpense, after: AssistantExpense) {
  const list: Array<string> = []
  const diff = (label: string, a: string | null, b: string | null) => {
    if (a !== b) list.push(`${label} ${a ?? '—'} → ${b ?? '—'}`)
  }
  diff('Description', before.description, after.description)
  diff(
    'Amount',
    formatMoney(before.amountCents, before.currency),
    formatMoney(after.amountCents, after.currency),
  )
  diff('Category', categoryLabel(before.category), categoryLabel(after.category))
  diff('Date', formatDate(before.date), formatDate(after.date))
  diff('Split', before.detail, after.detail)
  return list.join(' · ') || 'Nothing changed'
}

const KIND_ICON = { personal: Wallet, friend: User, group: Users }

function where(expense: AssistantExpense) {
  return expense.kind === 'personal'
    ? 'Personal'
    : expense.kind === 'friend'
      ? `With ${expense.with}`
      : `In ${expense.with}`
}

/** One expense, linking to the page it's on. */
function ExpenseItem({
  expense,
  variant = 'default',
  badge,
  note,
  className,
}: {
  expense: AssistantExpense
  variant?: 'default' | 'outline'
  badge?: React.ReactNode
  note?: string
  className?: string
}) {
  const Icon = KIND_ICON[expense.kind]
  return (
    <Item
      variant={variant}
      size="sm"
      className={className}
      render={<Link href={expense.href} className="no-underline" />}
    >
      <ItemMedia variant="icon" className="text-primary">
        <Icon />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full">
          <span className="truncate">{expense.description}</span>
          {badge}
        </ItemTitle>
        <ItemDescription className="line-clamp-2">
          {where(expense)} · {categoryLabel(expense.category)} · {formatDate(expense.date)}
          {expense.detail && ` · ${expense.detail}`}
        </ItemDescription>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </ItemContent>
      <ItemActions className="grid justify-items-end gap-0.5 self-start">
        <span className="font-semibold tabular-nums">
          {formatMoney(expense.amountCents, expense.currency)}
        </span>
        {expense.myShareCents !== expense.amountCents && (
          <span className="text-xs text-muted-foreground tabular-nums">
            your share {formatMoney(expense.myShareCents, expense.currency)}
          </span>
        )}
      </ItemActions>
    </Item>
  )
}

/** Search results: totals over every match, then the newest few. */
function FoundList({ event }: { event: Extract<ChatEvent, { type: 'found' }> }) {
  if (event.count === 0) return null
  return (
    <div className="grid overflow-hidden rounded-lg border">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b bg-muted/50 px-3 py-2">
        <span className="font-medium">
          {plural(event.count, 'expense')}
          {event.capped && '+'}
        </span>
        <span className="text-sm text-muted-foreground">
          {event.totals.map((t, i) => (
            <span key={t.currency}>
              {i > 0 && ' + '}
              <span className="font-semibold text-foreground tabular-nums">
                {formatMoney(t.cents, t.currency)}
              </span>
              {t.myShareCents !== t.cents &&
                ` (your share ${formatMoney(t.myShareCents, t.currency)})`}
            </span>
          ))}
        </span>
      </div>
      <div className="grid divide-y">
        {event.expenses.map((expense) => (
          <ExpenseItem key={expense.ref} expense={expense} className="rounded-none" />
        ))}
      </div>
      {event.count > event.expenses.length && (
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">
          Showing the newest {event.expenses.length} of {event.count}.
        </p>
      )}
    </div>
  )
}

/**
 * An expense the assistant offered to delete. The card is the confirmation
 * step (the model can only propose), so its button deletes directly.
 */
function DeleteOffer({ expense }: { expense: AssistantExpense }) {
  const removePersonal = useConvexMutation(api.personal.remove)
  const removeFriendEntry = useConvexMutation(api.friends.removeEntry)
  const removeGroupExpense = useConvexMutation(api.groups.removeExpense)
  const [deleted, setDeleted] = useState(false)
  const { run, pending } = useAction(
    async () => {
      if (expense.kind === 'personal') {
        await removePersonal({ expenseId: expense.id as Id<'personalExpenses'> })
      } else if (expense.kind === 'friend') {
        await removeFriendEntry({ entryId: expense.id as Id<'friendEntries'> })
      } else {
        await removeGroupExpense({ expenseId: expense.id as Id<'groupExpenses'> })
      }
    },
    { success: 'Deleted', toastErrors: true },
  )
  const Icon = KIND_ICON[expense.kind]

  return (
    <Item variant="outline" size="sm" className={deleted ? 'opacity-60' : 'border-destructive/40'}>
      <ItemMedia variant="icon" className={deleted ? 'text-muted-foreground' : 'text-destructive'}>
        {deleted ? <Icon /> : <Trash2 />}
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full">
          <span className={deleted ? 'truncate line-through' : 'truncate'}>
            {expense.description}
          </span>
          <span className="tabular-nums">{formatMoney(expense.amountCents, expense.currency)}</span>
        </ItemTitle>
        <ItemDescription className="line-clamp-2">
          {where(expense)} · {formatDate(expense.date)}
          {expense.detail && ` · ${expense.detail}`}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        {deleted ? (
          <Badge variant="outline">Deleted</Badge>
        ) : (
          <Button
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={async () => {
              if (await run()) setDeleted(true)
            }}
          >
            {pending && <Spinner />}
            Delete
          </Button>
        )}
      </ItemActions>
    </Item>
  )
}

function Tips({ onExample }: { onExample: (example: string) => void }) {
  return (
    <>
      <Section title="Try saying">
        <div className="grid gap-2">
          {EXAMPLES.map((example) => (
            <Button
              key={example}
              variant="outline"
              className="h-auto justify-start py-2 text-left font-normal whitespace-normal"
              onClick={() => onExample(example)}
            >
              {example}
            </Button>
          ))}
        </div>
      </Section>
      <Section title="What it can do">
        <ul className="grid list-disc gap-1.5 pl-4 text-sm text-muted-foreground">
          <li>
            Add personal, friend and group expenses: say who paid and how it’s split, or
            leave it to the defaults.
          </li>
          <li>
            Find expenses by what, when, who, category or amount, with totals and your share.
          </li>
          <li>
            Change any detail of an expense it found or added, like “make that 60” or “Priya
            paid for it”.
          </li>
          <li>Offer to delete an expense; nothing is deleted until you press Delete.</li>
          <li>
            Amounts are in your default currency (set in Settings) unless you name another;
            group expenses use the group’s currency.
          </li>
        </ul>
      </Section>
    </>
  )
}
