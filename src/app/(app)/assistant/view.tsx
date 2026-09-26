'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { convexQuery, useConvexAction } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { SendHorizontal, Sparkles, User, Users, Wallet } from 'lucide-react'

import { PageHeader, SplitLayout } from '#/components/page-header'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
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
import { categoryLabel, formatDate, formatMoney } from '#/lib/format'
import { readPreferences } from '#/lib/preferences'
import type { AddedExpense } from '#/lib/types'
import { api } from '#convex/_generated/api'

const EXAMPLES = [
  'Add tea personal expense 50',
  'Groceries 1,240 yesterday',
  'Lunch with Sam 30, I paid, split equally',
  'Taxi 600 in the Goa trip, paid by Priya',
]
// The same limits as convex/assistant.ts.
const MAX_MESSAGE = 500
const MAX_HISTORY = 12

type Message =
  | { id: number; role: 'user'; content: string }
  | { id: number; role: 'assistant'; content: string; added: Array<AddedExpense> }
  | { id: number; role: 'error'; content: string }

// The viewer's own date, not UTC: "today" is wherever they are.
function localIsoDate() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** A chat that turns plain language into expenses. */
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
        description="Tell Settlr what you spent, in your own words, and it adds the expense."
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
    const history = [
      ...messages.flatMap((m) =>
        m.role === 'error' ? [] : [{ role: m.role, content: m.content }],
      ),
      { role: 'user' as const, content },
    ].slice(-MAX_HISTORY)
    setMessages((list) => [...list, { id: nextId.current++, role: 'user', content }])
    setDraft('')
    setPending(true)
    try {
      const { reply, added } = await send({
        messages: history,
        today: localIsoDate(),
        currency: readPreferences().defaultCurrency,
      })
      setMessages((list) => [
        ...list,
        { id: nextId.current++, role: 'assistant', content: reply, added },
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
    <Card className="gap-0 py-0">
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
              <EmptyTitle>What did you spend?</EmptyTitle>
              <EmptyDescription>
                Say it the way you would to a friend. Personal, friend and group expenses
                all work.
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
          Conversations aren’t saved. Everything it adds shows up on the usual pages, where you
          can edit or delete it.
        </p>
      </form>
    </Card>
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
    <div className="grid max-w-[85%] gap-2">
      <p className="w-fit rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2 whitespace-pre-wrap">
        {message.content}
      </p>
      {message.added.map((expense, i) => (
        <AddedItem key={i} expense={expense} />
      ))}
    </div>
  )
}

const KIND_ICON = { personal: Wallet, friend: User, group: Users }

/** An expense the assistant added, linking to where it went. */
function AddedItem({ expense }: { expense: AddedExpense }) {
  const Icon = KIND_ICON[expense.kind]
  const where =
    expense.kind === 'personal'
      ? 'Personal'
      : expense.kind === 'friend'
        ? `With ${expense.with}`
        : `In ${expense.with}`
  return (
    <Item variant="outline" size="sm" className="no-underline" render={<Link href={expense.href} />}>
      <ItemMedia variant="icon" className="text-primary">
        <Icon />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="truncate">{expense.description}</ItemTitle>
        <ItemDescription className="truncate">
          {where} · {categoryLabel(expense.category)} · {formatDate(expense.date)}
        </ItemDescription>
      </ItemContent>
      <ItemActions className="font-semibold tabular-nums">
        {formatMoney(expense.amountCents, expense.currency)}
      </ItemActions>
    </Item>
  )
}

function Tips({ onExample }: { onExample: (example: string) => void }) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Try saying</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {EXAMPLES.map((example) => (
            <Button
              key={example}
              variant="outline"
              className="h-auto justify-start py-2 text-left whitespace-normal"
              onClick={() => onExample(example)}
            >
              {example}
            </Button>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>What it can do</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid list-disc gap-1.5 pl-4 text-muted-foreground">
            <li>Add personal expenses, one or several at a time.</li>
            <li>
              Add an expense with a friend: say who paid, and whether it’s split equally or
              owed in full.
            </li>
            <li>Add a group expense: say who paid and who it’s split between (everyone by default).</li>
            <li>
              Amounts are in your default currency (set in Settings) unless you name another;
              group expenses use the group’s currency.
            </li>
          </ul>
        </CardContent>
      </Card>
    </>
  )
}
