'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { convexQuery, useConvexAction, useConvexMutation } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import Link from 'next/link'
import {
  ArrowUp,
  Check,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Sparkles,
  Trash2,
  type LucideIcon,
} from 'lucide-react'

import { CategoryIcon } from '#/components/category'
import { useAction } from '#/components/ledger'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import { Spinner } from '#/components/ui/spinner'
import { errorMessage } from '#/lib/errors'
import { categoryLabel, formatDate, formatMoney, plural } from '#/lib/format'
import { readPreferences } from '#/lib/preferences'
import type { AssistantExpense, ChatEvent } from '#/lib/types'
import { cn } from '#/lib/utils'
import type { Id } from '#convex/_generated/dataModel'
import { api } from '#convex/_generated/api'

const EXAMPLES: ReadonlyArray<{ text: string; icon: LucideIcon }> = [
  { text: 'Add tea personal expense 50', icon: ReceiptText },
  { text: 'How much did I spend on food this month?', icon: Search },
  { text: 'Show my expenses with Sam', icon: Search },
  { text: 'Change the tea to 60', icon: Pencil },
  { text: 'Taxi 600 in the Goa trip, paid by Priya', icon: ReceiptText },
  { text: 'Delete yesterday’s taxi', icon: Trash2 },
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

// What you decided about an expense the assistant offered to delete, by the
// expense's `ref`. No entry means it's still waiting for you.
type Decisions = Record<string, 'deleted' | 'kept'>

// The viewer's own date, not UTC: "today" is wherever they are.
function localIsoDate() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/**
 * A chat that adds, finds and changes expenses from plain language. Every
 * change comes back as a card, and is listed beside the chat.
 */
export function AssistantView() {
  const { data: status } = useSuspenseQuery(convexQuery(api.assistant.status, {}))
  const configured = status.configured
  const id = useId()
  const send = useConvexAction(api.assistant.send)
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<Array<Message>>([])
  const [decisions, setDecisions] = useState<Decisions>({})
  const [pending, setPending] = useState(false)
  const nextId = useRef(0)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  // Keep the latest message in view.
  useEffect(() => {
    if (messages.length > 0) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, pending])

  function fillExample(example: string) {
    setDraft(example)
    inputRef.current?.focus()
  }

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

  const decide = (ref: string, decision: 'deleted' | 'kept') =>
    setDecisions((current) => ({ ...current, [ref]: decision }))

  return (
    <div className="grid items-start gap-x-8 gap-y-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-h-[calc(100svh-13rem)] min-w-0 flex-col lg:min-h-[calc(100svh-4.5rem)]">
        <header className="flex items-center gap-3 border-b border-divider pb-4">
          <AssistantMark className="size-10 rounded-xl [&_svg]:size-5" />
          <div className="grid min-w-0 gap-0.5">
            <h1 className="m-0 text-[1.0625rem] font-semibold tracking-[-0.02em]">
              Settlr Assistant
            </h1>
            <p className="text-xs text-muted-foreground">
              Adds, edits and finds expenses. Asks before every delete.
            </p>
          </div>
        </header>

        <div role="log" aria-label="Conversation" className="flex-1 py-7">
          <div className="mx-auto flex max-w-190 flex-col gap-5.5">
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
            {messages.length === 0 && (
              <div className="grid justify-items-center gap-3 py-12 text-center">
                <AssistantMark className="size-14 rounded-2xl [&_svg]:size-7" />
                <h2 className="m-0 text-2xl font-semibold tracking-[-0.03em]">
                  What can I do for you?
                </h2>
                <p className="max-w-md text-muted-foreground">
                  Add an expense, ask what you spent, or change one you already have.
                  Personal, friend and group expenses all work.
                </p>
              </div>
            )}
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                decisions={decisions}
                onDecide={decide}
              />
            ))}
            {pending && (
              <AssistantTurn>
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Spinner />
                  Thinking…
                </p>
              </AssistantTurn>
            )}
          </div>
        </div>

        <form
          className="sticky bottom-25 z-10 bg-background pt-3 pb-2 lg:bottom-0 lg:pb-4.5"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <div className="mx-auto flex max-w-190 flex-col gap-2.5">
            <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] sm:flex-wrap">
              {EXAMPLES.slice(0, 3).map((example) => (
                <button
                  key={example.text}
                  type="button"
                  onClick={() => fillExample(example.text)}
                  className="min-h-9 shrink-0 rounded-full border border-input px-3 text-[0.8125rem] text-soft outline-none hover:bg-tile focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {example.text}
                </button>
              ))}
            </div>
            <div className="flex items-end gap-2 rounded-[20px] border border-input bg-card py-2 pr-2 pl-4 focus-within:border-primary">
              <label htmlFor={`${id}-message`} className="sr-only">
                Message the assistant
              </label>
              <textarea
                id={`${id}-message`}
                ref={inputRef}
                value={draft}
                rows={2}
                maxLength={MAX_MESSAGE}
                disabled={!configured}
                placeholder="Add, edit or find an expense… e.g. “Rohan paid 900 for petrol, split 3 ways”"
                className="field-sizing-content max-h-40 min-h-12 flex-1 resize-none border-0 bg-transparent py-1.5 leading-normal outline-none placeholder:text-faint disabled:opacity-50"
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
                <ArrowUp className="size-4.5" strokeWidth={2.4} />
              </Button>
            </div>
            <p className="text-center text-xs text-faint">
              Conversations aren’t saved. Everything it adds or changes shows up on the usual
              pages.
            </p>
          </div>
        </form>
        <div ref={endRef} />
      </div>

      <aside className="flex flex-col gap-5 rounded-3xl border bg-sidebar p-5 xl:sticky xl:top-6">
        <Changes messages={messages} decisions={decisions} />
        <div className="grid gap-2.5">
          <span className="font-semibold">Try asking</span>
          <ul className="grid gap-1">
            {EXAMPLES.map((example) => (
              <li key={example.text}>
                <button
                  type="button"
                  onClick={() => fillExample(example.text)}
                  className="-mx-2 flex w-[calc(100%+1rem)] items-start gap-2.5 rounded-lg px-2 py-1.5 text-left text-[0.8125rem] text-soft outline-none hover:bg-tile focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <example.icon className="mt-px size-4 shrink-0 text-primary" aria-hidden="true" />
                  “{example.text}”
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid gap-2 rounded-2xl border bg-card p-4">
          <span className="font-semibold">Good to know</span>
          <ul className="grid list-disc gap-1.5 pl-4 text-[0.8125rem] leading-[1.45] text-muted-foreground">
            <li>Say who paid and how it’s split, or leave it to the defaults.</li>
            <li>Nothing is deleted until you press Delete on its card.</li>
            <li>
              Amounts are in your default currency (set in Settings) unless you name another;
              group expenses use the group’s currency.
            </li>
          </ul>
        </div>
      </aside>
    </div>
  )
}

function AssistantMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-[10px] border border-highlight-border bg-highlight text-primary [&_svg]:size-4',
        className,
      )}
    >
      <Sparkles />
    </span>
  )
}

/** The assistant's side of the chat: its mark, then what it said and did. */
function AssistantTurn({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <AssistantMark />
      <div className="flex min-w-0 flex-1 flex-col gap-2.5 pt-1">{children}</div>
    </div>
  )
}

function ChatMessage({
  message,
  decisions,
  onDecide,
}: {
  message: Message
  decisions: Decisions
  onDecide: (ref: string, decision: 'deleted' | 'kept') => void
}) {
  if (message.role === 'user') {
    return (
      <p className="max-w-[78%] self-end rounded-[18px_18px_4px_18px] bg-tile px-4 py-3 leading-normal whitespace-pre-wrap">
        {message.content}
      </p>
    )
  }
  if (message.role === 'error') {
    return (
      <AssistantTurn>
        <p className="leading-normal text-destructive">{message.content}</p>
      </AssistantTurn>
    )
  }
  return (
    <AssistantTurn>
      <p className="leading-normal whitespace-pre-wrap text-soft">{message.content}</p>
      {message.events.map((event, i) => (
        <EventCard
          key={i}
          event={event}
          decision={event.type === 'delete' ? decisions[event.expense.ref] : undefined}
          onDecide={onDecide}
        />
      ))}
    </AssistantTurn>
  )
}

function EventCard({
  event,
  decision,
  onDecide,
}: {
  event: ChatEvent
  decision: 'deleted' | 'kept' | undefined
  onDecide: (ref: string, decision: 'deleted' | 'kept') => void
}) {
  switch (event.type) {
    case 'added':
      return <AddedCard expense={event.expense} />
    case 'updated':
      return <EditCard before={event.before} after={event.expense} />
    case 'delete':
      return <DeleteOffer expense={event.expense} decision={decision} onDecide={onDecide} />
    case 'found':
      return <FoundList event={event} />
  }
}

function where(expense: AssistantExpense) {
  return expense.kind === 'personal'
    ? 'Personal'
    : expense.kind === 'friend'
      ? `With ${expense.with}`
      : `In ${expense.with}`
}

const eventCard = 'overflow-hidden rounded-2xl border bg-card'
const applied = 'flex items-center gap-1.5 text-[0.8125rem] font-semibold text-primary'
const quietLink = 'text-[0.8125rem] text-muted-foreground no-underline hover:text-primary'

/** One expense: what it is, where it lives and what it cost. */
function ExpenseRow({ expense, className }: { expense: AssistantExpense; className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 px-4 py-3.5', className)}>
      <CategoryIcon category={expense.category} className="size-9.5 rounded-[11px] [&_svg]:size-4.5" />
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="truncate font-semibold">{expense.description}</span>
        <span className="truncate text-xs text-muted-foreground">
          {categoryLabel(expense.category)} · {where(expense)} · {formatDate(expense.date)}
          {expense.detail && ` · ${expense.detail}`}
        </span>
      </span>
      <span className="grid justify-items-end gap-0.5">
        <span className="font-mono text-[1.0625rem] font-medium tabular-nums">
          {formatMoney(expense.amountCents, expense.currency)}
        </span>
        {expense.myShareCents !== expense.amountCents && (
          <span className="text-xs text-muted-foreground">
            your share {formatMoney(expense.myShareCents, expense.currency)}
          </span>
        )}
      </span>
    </div>
  )
}

function AddedCard({ expense }: { expense: AssistantExpense }) {
  return (
    <div className={eventCard}>
      <ExpenseRow expense={expense} />
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-divider bg-field/60 px-4 py-2.5">
        <span className={applied}>
          <Check className="size-3.5" strokeWidth={2.6} />
          Added
        </span>
        <Link href={expense.href} className={quietLink}>
          Open
        </Link>
      </div>
    </div>
  )
}

// What an edit changed, field by field.
function changes(before: AssistantExpense, after: AssistantExpense) {
  const list: Array<{ label: string; before: string; after: string }> = []
  const diff = (label: string, a: string | null, b: string | null) => {
    if (a !== b) list.push({ label, before: a ?? '—', after: b ?? '—' })
  }
  diff('Description', before.description, after.description)
  diff(
    'Total',
    formatMoney(before.amountCents, before.currency),
    formatMoney(after.amountCents, after.currency),
  )
  diff('Category', categoryLabel(before.category), categoryLabel(after.category))
  diff('Date', formatDate(before.date), formatDate(after.date))
  diff('Split', before.detail, after.detail)
  return list
}

/** An edit as a diff: each changed field, old value struck through. */
function EditCard({ before, after }: { before: AssistantExpense; after: AssistantExpense }) {
  const changed = changes(before, after)
  return (
    <div className={cn(eventCard, 'grid gap-2.5 px-4 py-3.5')}>
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate font-semibold">Edit · {after.description}</span>
        <span className={cn(applied, 'text-xs')}>
          <Check className="size-3.5" strokeWidth={2.6} />
          Applied
        </span>
      </div>
      {changed.length === 0 ? (
        <p className="text-[0.8125rem] text-muted-foreground">Nothing changed.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(150px,100%),1fr))] gap-2">
          {changed.map((change) => (
            <div key={change.label} className="grid gap-1 rounded-xl bg-field px-3 py-2.5">
              <span className="text-xs text-muted-foreground">{change.label}</span>
              <span className="font-mono text-[0.8125rem]">
                <s className="text-faint">{change.before}</s> → {change.after}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs text-muted-foreground">
          {where(after)} · {formatDate(after.date)}
        </span>
        <Link href={after.href} className={quietLink}>
          Open
        </Link>
      </div>
    </div>
  )
}

/** Search results: totals over every match, then the newest few. */
function FoundList({ event }: { event: Extract<ChatEvent, { type: 'found' }> }) {
  if (event.count === 0) return null
  return (
    <div className={eventCard}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 bg-field/60 px-4 py-2.5">
        <span className="font-semibold">
          {plural(event.count, 'expense')}
          {event.capped && '+'}
        </span>
        <span className="text-[0.8125rem] text-muted-foreground">
          {event.totals.map((t, i) => (
            <span key={t.currency}>
              {i > 0 && ' + '}
              <span className="font-mono font-medium text-foreground tabular-nums">
                {formatMoney(t.cents, t.currency)}
              </span>
              {t.myShareCents !== t.cents &&
                ` (your share ${formatMoney(t.myShareCents, t.currency)})`}
            </span>
          ))}
        </span>
      </div>
      {event.expenses.map((expense) => (
        <Link
          key={expense.ref}
          href={expense.href}
          className="block border-t border-divider no-underline hover:bg-tile/50"
        >
          <ExpenseRow expense={expense} className="py-3" />
        </Link>
      ))}
      {event.count > event.expenses.length && (
        <p className="border-t border-divider px-4 py-2.5 text-xs text-muted-foreground">
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
function DeleteOffer({
  expense,
  decision,
  onDecide,
}: {
  expense: AssistantExpense
  decision: 'deleted' | 'kept' | undefined
  onDecide: (ref: string, decision: 'deleted' | 'kept') => void
}) {
  const removePersonal = useConvexMutation(api.personal.remove)
  const removeFriendEntry = useConvexMutation(api.friends.removeEntry)
  const removeGroupExpense = useConvexMutation(api.groups.removeExpense)
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
  const waiting = decision === undefined
  const going = decision !== 'kept'

  return (
    <div
      className={cn(
        eventCard,
        'grid gap-2.5 px-4 py-3.5',
        waiting && 'border-danger-border',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate font-semibold">Delete · {expense.description}</span>
        <span
          className={cn(
            'shrink-0 rounded-full px-2.25 py-0.75 text-xs font-semibold',
            waiting ? 'bg-destructive/14 text-destructive' : 'bg-divider text-soft',
          )}
        >
          {waiting ? 'Waiting for you' : decision === 'deleted' ? 'Deleted' : 'Kept'}
        </span>
      </div>
      <div
        className={cn(
          'flex items-center gap-3 rounded-xl px-3 py-2.5',
          going ? 'border border-dashed border-danger-border bg-destructive/8' : 'bg-field',
        )}
      >
        <span
          className={cn(
            'w-14 shrink-0 text-[0.6875rem] font-semibold tracking-[0.06em]',
            going ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {going ? 'DELETE' : 'KEEP'}
        </span>
        <span className={cn('min-w-0 flex-1 truncate', going && 'text-soft line-through')}>
          {expense.description} · {where(expense)} · {formatDate(expense.date)}
        </span>
        <span className={cn('font-mono tabular-nums', going && 'text-soft line-through')}>
          {formatMoney(expense.amountCents, expense.currency)}
        </span>
      </div>
      {waiting && (
        <div className="flex flex-wrap gap-2 pt-0.5">
          <Button
            variant="destructive"
            size="lg"
            disabled={pending}
            onClick={async () => {
              if (await run()) onDecide(expense.ref, 'deleted')
            }}
          >
            {pending && <Spinner />}
            Delete
          </Button>
          <Button
            variant="outline"
            size="lg"
            disabled={pending}
            onClick={() => onDecide(expense.ref, 'kept')}
          >
            Keep it
          </Button>
        </div>
      )}
    </div>
  )
}

/** Everything the assistant changed (or is waiting to) in this chat. */
function Changes({ messages, decisions }: { messages: Array<Message>; decisions: Decisions }) {
  const items = messages.flatMap((message) =>
    message.role === 'assistant'
      ? message.events.flatMap((event, i) =>
          event.type === 'found' ? [] : [{ key: `${message.id}:${i}`, event }],
        )
      : [],
  )

  return (
    <div className="grid gap-3">
      <h2 className="m-0 text-[0.9375rem] font-semibold tracking-[-0.02em]">
        Changes in this chat
      </h2>
      {items.length === 0 ? (
        <p className="text-[0.8125rem] leading-[1.45] text-muted-foreground">
          Nothing yet. Whatever the assistant adds, edits or offers to delete is listed here.
        </p>
      ) : (
        <ol className="grid">
          {items.map(({ key, event }, i) => {
            const { expense } = event
            const last = i === items.length - 1
            const decision = event.type === 'delete' ? decisions[expense.ref] : undefined
            const waiting = event.type === 'delete' && decision === undefined
            return (
              <li key={key} className="flex gap-3">
                <span className="flex flex-col items-center">
                  {waiting ? (
                    <span className="size-5.5 rounded-full border-2 border-dashed border-destructive" />
                  ) : (
                    <span
                      className={cn(
                        'grid size-5.5 place-items-center rounded-full text-on-fill [&_svg]:size-3',
                        event.type === 'added'
                          ? 'bg-primary text-primary-foreground'
                          : event.type === 'updated'
                            ? 'bg-positive text-background'
                            : 'bg-segment text-soft',
                      )}
                    >
                      {event.type === 'added' ? (
                        <Plus strokeWidth={3} />
                      ) : event.type === 'updated' ? (
                        <Pencil strokeWidth={2.6} />
                      ) : (
                        <Trash2 strokeWidth={2.4} />
                      )}
                    </span>
                  )}
                  {!last && <span className="min-h-4.5 w-0.5 flex-1 bg-segment" />}
                </span>
                <span className={cn('grid min-w-0 flex-1 gap-0.5', !last && 'pb-3.5')}>
                  <span className="truncate font-semibold">
                    {event.type === 'added'
                      ? 'Added'
                      : event.type === 'updated'
                        ? 'Edited'
                        : decision === 'deleted'
                          ? 'Deleted'
                          : decision === 'kept'
                            ? 'Kept'
                            : 'Delete'}{' '}
                    {expense.description}
                  </span>
                  <span
                    className={cn(
                      'truncate text-xs',
                      waiting ? 'text-destructive' : 'text-muted-foreground',
                    )}
                  >
                    {waiting
                      ? 'Waiting for your OK'
                      : `${formatMoney(expense.amountCents, expense.currency)} · ${where(expense)}`}
                  </span>
                </span>
                {decision !== 'deleted' && (
                  <Link href={expense.href} className="text-xs text-muted-foreground no-underline hover:text-primary">
                    Open
                  </Link>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
