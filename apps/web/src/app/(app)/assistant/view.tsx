'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { convexQuery, useConvexAction, useConvexMutation } from '@convex-dev/react-query'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { useConvex } from 'convex/react'
import Link from 'next/link'
import {
  ArrowRight,
  ArrowUp,
  Check,
  HandCoins,
  History,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react'

import { CategoryIcon } from '#/components/category'
import { RobotIcon } from '#/components/robot-icon'
import { useAction } from '#/components/ledger'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { Spinner } from '#/components/ui/spinner'
import { errorMessage } from '#/lib/errors'
import { categoryLabel, formatDate, formatMoney, plural } from '@settlr/shared/format'
import { readPreferences } from '#/lib/preferences'
import type { AssistantExpense, ChatEvent } from '#/lib/types'
import { cn } from '#/lib/utils'
import type { Id } from '@settlr/backend/convex/_generated/dataModel'
import { api } from '@settlr/backend/convex/_generated/api'

// The empty chat's suggestions: one per thing the assistant does. A click
// puts the example in the message box to send or change.
const STARTERS: ReadonlyArray<{
  label: string
  example: string
  icon: LucideIcon
  tone: string
}> = [
  { label: 'Add an expense', example: 'Coffee 120', icon: Plus, tone: 'bg-primary/14 text-primary' },
  {
    label: 'Ask about spending',
    example: 'How much did I spend on food this month?',
    icon: Search,
    tone: 'bg-positive/14 text-positive',
  },
  { label: 'Edit an expense', example: 'Change the coffee to 150', icon: Pencil, tone: 'bg-tile text-muted-foreground' },
  {
    label: 'Delete an expense',
    example: 'Delete the coffee',
    icon: Trash2,
    tone: 'bg-destructive/14 text-destructive',
  },
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
  const saveTurn = useConvexMutation(api.chats.append)
  const convex = useConvex()
  const [chatId, setChatId] = useState<Id<'assistantChats'> | null>(null)
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
      // Keep the conversation, so it can be reopened from Saved chats.
      saveTurn({ chatId, user: content, reply, memo, events: JSON.stringify(events) }).then(
        (id) => setChatId(id),
        () => {},
      )
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

  function newChat() {
    setMessages([])
    setDecisions({})
    setDraft('')
    setChatId(null)
    inputRef.current?.focus()
  }

  async function openChat(id: Id<'assistantChats'>) {
    const chat = await convex.query(api.chats.get, { chatId: id })
    if (!chat) return
    setChatId(chat.id)
    setDecisions({})
    setMessages(
      chat.messages.map((m): Message =>
        m.role === 'user'
          ? { id: nextId.current++, role: 'user', content: m.content }
          : {
              id: nextId.current++,
              role: 'assistant',
              content: m.content,
              memo: m.memo,
              events: JSON.parse(m.events) as Array<ChatEvent>,
            },
      ),
    )
  }

  // The changes panel only appears once there's something in it.
  const hasChanges = messages.some(
    (m) => m.role === 'assistant' && m.events.some((event) => event.type !== 'found'),
  )

  return (
    <div
      className={cn(
        'grid items-start gap-x-8 gap-y-6',
        hasChanges && 'xl:grid-cols-[minmax(0,1fr)_20rem]',
      )}
    >
      {/* The chat fills the page panel exactly, so the composer sits at its
          foot: it cancels the page's bottom padding (all of it from `lg`; on
          phones, all but the bottom tab bar's height) and is as tall as
          what's left (100svh less the top bar, the panel's rim and the
          page's top padding; on phones the top bar, top padding and tab
          bar). */}
      <div className="flex min-h-[calc(100svh-7.25rem-env(safe-area-inset-bottom))] min-w-0 flex-col max-lg:mb-[calc(env(safe-area-inset-bottom)-3.375rem)] lg:-mb-12 lg:min-h-[calc(100svh-4.75rem)]">
        {/* The breadcrumb names the page and the empty chat introduces it,
            so there's no visible title; up here are the saved chats and,
            once there's a conversation, starting a new one. */}
        <h1 className="sr-only">AI Assistant</h1>
        <div className="mx-auto flex w-full max-w-190 justify-end gap-2">
          <SavedChats current={chatId} onOpen={(id) => void openChat(id)} disabled={pending} />
          {messages.length > 0 && (
            <Button variant="outline" onClick={newChat} disabled={pending}>
              <Plus />
              New chat
            </Button>
          )}
        </div>

        <div role="log" aria-label="Conversation" className="flex flex-1 flex-col py-7">
          {/* Each message rises in as it arrives. */}
          <div className="mx-auto flex w-full max-w-190 flex-1 flex-col gap-5.5 *:animate-rise-in">
            {!configured && (
              <Alert>
                <RobotIcon />
                <AlertTitle>The assistant isn’t set up yet</AlertTitle>
                <AlertDescription>
                  Set <code>OPENROUTER_API_KEY</code> and <code>OPENROUTER_MODEL</code> on the
                  Convex deployment to turn it on.
                </AlertDescription>
              </Alert>
            )}
            {messages.length === 0 && (
              // The empty chat sits in the middle of the space above the
              // composer.
              <div className="my-auto grid gap-7 py-6">
                <div className="grid justify-items-center gap-2 text-center">
                  {/* The big one bobs and blinks now and then. */}
                  <AssistantMark className="size-12 animate-bob rounded-xl [&_svg]:size-6 [&_.robot-eye]:origin-center [&_.robot-eye]:animate-blink [&_.robot-eye]:[transform-box:fill-box]" />
                  <h2 className="m-0 mt-2 text-xl font-semibold">What should I do?</h2>
                  <p className="max-w-md text-sm text-muted-foreground">
                    Tell me about an expense the way you’d text a friend, or ask about your
                    spending. I’ll check with you before deleting anything.
                  </p>
                </div>
                <ul className="stagger grid gap-2.5 sm:grid-cols-2">
                  {STARTERS.map((starter) => (
                    <li key={starter.label}>
                      <button
                        type="button"
                        disabled={!configured}
                        onClick={() => fillExample(starter.example)}
                        className="flex w-full items-center gap-3 rounded-xl border bg-card p-3.5 text-left outline-none transition-[background-color,border-color,translate] duration-200 ease-out-quint enabled:hover:-translate-y-0.5 enabled:hover:border-input enabled:hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:opacity-50"
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            'grid size-9 shrink-0 place-items-center rounded-lg [&_svg]:size-4',
                            starter.tone,
                          )}
                        >
                          <starter.icon />
                        </span>
                        <span className="grid min-w-0">
                          <span className="font-medium">{starter.label}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            “{starter.example}”
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
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

        {/* Pinned to the bottom of the panel (above the tab bar on phones),
            with a fade above it for the messages that scroll under it. */}
        <form
          className="sticky bottom-[calc(3.625rem+env(safe-area-inset-bottom))] z-10 bg-background pt-1 pb-3 before:pointer-events-none before:absolute before:inset-x-0 before:-top-8 before:h-8 before:bg-linear-to-t before:from-background before:to-transparent lg:bottom-0 lg:pb-4"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <div className="mx-auto flex max-w-190 items-end gap-2 rounded-xl border border-input bg-field py-1.5 pr-1.5 pl-4 shadow-[0_1px_2px_rgb(0_0_0/4%),0_10px_28px_-14px_rgb(0_0_0/18%)] transition-[border-color,box-shadow] duration-140 focus-within:border-ring focus-within:ring-3 focus-within:ring-primary-soft dark:shadow-[0_14px_32px_-18px_rgb(0_0_0/75%)]">
            <label htmlFor={`${id}-message`} className="sr-only">
              Message the AI Assistant
            </label>
            <textarea
              id={`${id}-message`}
              ref={inputRef}
              value={draft}
              rows={1}
              maxLength={MAX_MESSAGE}
              disabled={!configured}
              placeholder="e.g. Dinner 1200, split with Rohan"
              className="field-sizing-content max-h-40 min-h-9 flex-1 resize-none border-0 bg-transparent py-1.75 text-[0.9375rem] leading-normal outline-none placeholder:text-faint disabled:opacity-50"
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
              className="rounded-lg"
              disabled={!configured || pending || !draft.trim()}
            >
              {pending ? <Spinner /> : <ArrowUp className="size-4.5" strokeWidth={2.4} />}
            </Button>
          </div>
          <p className="mx-auto mt-2 flex max-w-190 items-center justify-between gap-3 px-1 text-2xs text-faint max-sm:hidden">
            <span className="flex items-center gap-1">
              <kbd className="kbd">↵</kbd> to send
              <span className="mx-1 text-dim">·</span>
              <kbd className="kbd">Shift</kbd>
              <kbd className="kbd">↵</kbd> for a new line
            </span>
            <span>Asks before deleting anything</span>
          </p>
        </form>
        <div ref={endRef} />
      </div>

      {hasChanges && (
        <aside className="rounded-xl border bg-sunken p-3.5 xl:sticky xl:top-4">
          <Changes messages={messages} decisions={decisions} />
        </aside>
      )}
    </div>
  )
}

function AssistantMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-lg border border-highlight-border bg-highlight text-primary [&_svg]:size-4',
        className,
      )}
    >
      <RobotIcon />
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
      <p className="max-w-[78%] self-end rounded-2xl rounded-br-sm bg-tile px-4 py-3 leading-normal whitespace-pre-wrap">
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
      <p className="leading-normal whitespace-pre-wrap text-foreground">{message.content}</p>
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
    case 'created':
      return <CreatedCard event={event} />
    case 'payment':
      return <PaymentCard event={event} />
  }
}

function where(expense: AssistantExpense) {
  return expense.kind === 'personal'
    ? 'Personal'
    : expense.kind === 'friend'
      ? `With ${expense.with}`
      : `In ${expense.with}`
}

const eventCard = 'overflow-hidden rounded-xl border bg-card'
const applied = 'flex items-center gap-1.5 text-xs font-medium text-primary'
const quietLink = 'text-xs font-medium text-muted-foreground no-underline hover:text-foreground'

/** One expense: what it is, where it lives and what it cost. */
function ExpenseRow({ expense, className }: { expense: AssistantExpense; className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 px-4 py-3.5', className)}>
      <CategoryIcon category={expense.category} className="size-9.5 rounded-lg [&_svg]:size-4.5" />
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="truncate font-medium">{expense.description}</span>
        <span className="truncate text-xs text-muted-foreground">
          {categoryLabel(expense.category)} · {where(expense)} · {formatDate(expense.date)}
          {expense.detail && ` · ${expense.detail}`}
        </span>
      </span>
      <span className="grid justify-items-end gap-0.5">
        <span className="text-base font-medium tabular-nums">
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

/** A group or friend the assistant created. */
function CreatedCard({ event }: { event: Extract<ChatEvent, { type: 'created' }> }) {
  const Icon = event.kind === 'group' ? Users : UserPlus
  return (
    <div className={eventCard}>
      <div className="flex items-center gap-3 px-4 py-3.5">
        <span className="grid size-9.5 shrink-0 place-items-center rounded-lg bg-primary/14 text-primary [&_svg]:size-4.5">
          <Icon />
        </span>
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="truncate font-medium">{event.name}</span>
          <span className="truncate text-xs text-muted-foreground">{event.detail}</span>
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-divider bg-field/60 px-4 py-2.5">
        <span className={applied}>
          <Check className="size-3.5" strokeWidth={2.6} />
          {event.kind === 'group' ? 'Group created' : 'Friend added'}
        </span>
        <Link href={event.href} className={quietLink}>
          Open
        </Link>
      </div>
    </div>
  )
}

/** A settle-up payment the assistant recorded: who paid whom, and where it leaves you. */
function PaymentCard({ event }: { event: Extract<ChatEvent, { type: 'payment' }> }) {
  return (
    <div className={eventCard}>
      <div className="flex items-center gap-3 px-4 py-3.5">
        <span className="grid size-9.5 shrink-0 place-items-center rounded-lg bg-positive/14 text-positive [&_svg]:size-4.5">
          <HandCoins />
        </span>
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="flex min-w-0 items-center gap-1.5 font-medium">
            <span className="truncate">{event.from}</span>
            <ArrowRight className="size-3.5 shrink-0 text-faint" role="img" aria-label="paid" />
            <span className="truncate">{event.to}</span>
          </span>
          <span className="truncate text-xs text-muted-foreground">
            Settle-up · {event.kind === 'group' ? `In ${event.where}` : `With ${event.where}`} ·{' '}
            {formatDate(event.date)}
          </span>
        </span>
        <span className="text-base font-medium tabular-nums">
          {formatMoney(event.amountCents, event.currency)}
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-divider bg-field/60 px-4 py-2.5">
        <span className={applied}>
          <Check className="size-3.5" strokeWidth={2.6} />
          Payment recorded
          <span className="font-normal text-muted-foreground">· {event.balance}</span>
        </span>
        <Link href={event.href} className={quietLink}>
          Open
        </Link>
      </div>
    </div>
  )
}

/** A recorded payment in the Changes panel. */
function PaymentStep({
  event,
  last,
}: {
  event: Extract<ChatEvent, { type: 'payment' }>
  last: boolean
}) {
  return (
    <li className="flex gap-3">
      <span className="flex flex-col items-center">
        <span className="grid size-5.5 place-items-center rounded-full bg-positive text-background [&_svg]:size-3">
          <HandCoins strokeWidth={2.6} />
        </span>
        {!last && <span className="min-h-4.5 w-px flex-1 bg-track" />}
      </span>
      <span className={cn('grid min-w-0 flex-1 gap-0.5', !last && 'pb-3.5')}>
        <span className="truncate font-medium">
          {event.from} paid {event.to === 'You' ? 'you' : event.to}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {formatMoney(event.amountCents, event.currency)} · {event.where}
        </span>
      </span>
      <Link href={event.href} className="text-xs text-muted-foreground no-underline hover:text-primary">
        Open
      </Link>
    </li>
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
        <span className="min-w-0 truncate font-medium">Edit · {after.description}</span>
        <span className={cn(applied, 'text-xs')}>
          <Check className="size-3.5" strokeWidth={2.6} />
          Applied
        </span>
      </div>
      {changed.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing changed.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(150px,100%),1fr))] gap-2">
          {changed.map((change) => (
            <div key={change.label} className="grid gap-1 rounded-lg bg-field px-3 py-2.5">
              <span className="text-xs text-muted-foreground">{change.label}</span>
              <span className="text-xs">
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
        <span className="font-medium">
          {plural(event.count, 'expense')}
          {event.capped && '+'}
        </span>
        <span className="text-xs text-muted-foreground">
          {event.totals.map((t, i) => (
            <span key={t.currency}>
              {i > 0 && ' + '}
              <span className="font-medium text-foreground tabular-nums">
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
        <span className="min-w-0 truncate font-medium">Delete · {expense.description}</span>
        <span
          className={cn(
            'shrink-0 rounded-sm px-1.5 py-0.5 text-xs font-medium',
            waiting ? 'bg-destructive/10 text-destructive' : 'bg-raised text-foreground',
          )}
        >
          {waiting ? 'Waiting for you' : decision === 'deleted' ? 'Deleted' : 'Kept'}
        </span>
      </div>
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2.5',
          going ? 'border border-dashed border-danger-border bg-destructive/8' : 'bg-field',
        )}
      >
        <span
          className={cn(
            'w-14 shrink-0 text-xs font-medium',
            going ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {going ? 'Delete' : 'Keep'}
        </span>
        <span className={cn('min-w-0 flex-1 truncate', going && 'text-muted-foreground line-through')}>
          {expense.description} · {where(expense)} · {formatDate(expense.date)}
        </span>
        <span className={cn('tabular-nums', going && 'text-muted-foreground line-through')}>
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

/** A step in the changes panel for a new group or friend. */
function CreatedStep({
  event,
  last,
}: {
  event: Extract<ChatEvent, { type: 'created' }>
  last: boolean
}) {
  const Icon = event.kind === 'group' ? Users : UserPlus
  return (
    <li className="flex gap-3">
      <span className="flex flex-col items-center">
        <span className="grid size-5.5 place-items-center rounded-full bg-primary text-primary-foreground [&_svg]:size-3">
          <Icon strokeWidth={2.6} />
        </span>
        {!last && <span className="min-h-4.5 w-px flex-1 bg-track" />}
      </span>
      <span className={cn('grid min-w-0 flex-1 gap-0.5', !last && 'pb-3.5')}>
        <span className="truncate font-medium">
          {event.kind === 'group' ? 'Created' : 'Added friend'} {event.name}
        </span>
        <span className="truncate text-xs text-muted-foreground">{event.detail}</span>
      </span>
      <Link href={event.href} className="text-xs text-muted-foreground no-underline hover:text-primary">
        Open
      </Link>
    </li>
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
      <h2 className="m-0 text-base font-semibold">Changes</h2>
      {items.length === 0 ? null : (
        <ol className="grid">
          {items.map(({ key, event }, i) => {
            const last = i === items.length - 1
            if (event.type === 'created') {
              return <CreatedStep key={key} event={event} last={last} />
            }
            if (event.type === 'payment') {
              return <PaymentStep key={key} event={event} last={last} />
            }
            const { expense } = event
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
                        'grid size-5.5 place-items-center rounded-full [&_svg]:size-3',
                        event.type === 'added'
                          ? 'bg-primary text-primary-foreground'
                          : event.type === 'updated'
                            ? 'bg-positive text-background'
                            : 'bg-raised text-foreground',
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
                  {!last && <span className="min-h-4.5 w-px flex-1 bg-track" />}
                </span>
                <span className={cn('grid min-w-0 flex-1 gap-0.5', !last && 'pb-3.5')}>
                  <span className="truncate font-medium">
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

/** A menu of earlier conversations to reopen (or delete). */
function SavedChats({
  current,
  onOpen,
  disabled,
}: {
  current: Id<'assistantChats'> | null
  onOpen: (id: Id<'assistantChats'>) => void
  disabled: boolean
}) {
  const { data: chats } = useQuery(convexQuery(api.chats.list, {}))
  const remove = useConvexMutation(api.chats.remove)
  if (!chats || chats.length === 0) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" disabled={disabled} />}>
        <History />
        Saved chats
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {chats.map((chat) => (
          <DropdownMenuItem
            key={chat.id}
            onClick={() => onOpen(chat.id)}
            className={cn(chat.id === current && 'font-medium')}
          >
            <span className="min-w-0 flex-1 truncate">{chat.title}</span>
            <span
              role="button"
              tabIndex={-1}
              aria-label={`Delete chat ${chat.title}`}
              className="text-muted-foreground hover:text-destructive"
              onClick={(event) => {
                event.stopPropagation()
                void remove({ chatId: chat.id })
              }}
            >
              <Trash2 className="size-3.5" />
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
