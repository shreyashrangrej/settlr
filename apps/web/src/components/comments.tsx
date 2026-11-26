'use client'

import { useState } from 'react'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { Send, Trash2 } from 'lucide-react'

import { PersonAvatar, useAction } from '#/components/ledger'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '#/components/ui/dialog'
import { FieldError } from '#/components/ui/field'
import { Spinner } from '#/components/ui/spinner'
import { Textarea } from '#/components/ui/textarea'
import { api } from '@settlr/backend/convex/_generated/api'
import type { Id } from '@settlr/backend/convex/_generated/dataModel'

/**
 * The comment thread on a group expense ("was this the dinner on Friday?"),
 * in a dialog opened from the expense's "⋯" menu. The thread loads when it
 * opens.
 */
export function CommentsDialog({
  expenseId,
  title,
  open,
  onOpenChange,
}: {
  expenseId: Id<'groupExpenses'>
  title: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col gap-0 overflow-hidden p-0 sm:max-w-120">
        <header className="grid gap-1 px-4 pt-3.5 pr-12">
          <DialogTitle className="truncate">Comments on “{title}”</DialogTitle>
          <DialogDescription className="text-xs">
            Everyone in the group can read them; the people on it are told.
          </DialogDescription>
        </header>
        {open && <Thread expenseId={expenseId} />}
      </DialogContent>
    </Dialog>
  )
}

function Thread({ expenseId }: { expenseId: Id<'groupExpenses'> }) {
  const { data: comments } = useQuery(convexQuery(api.groups.comments, { expenseId }))
  const add = useAction(useConvexMutation(api.groups.addComment))
  const remove = useAction(useConvexMutation(api.groups.removeComment), { toastErrors: true })
  const [body, setBody] = useState('')

  return (
    <>
      <div className="max-h-[min(24rem,55svh)] min-h-0 overflow-y-auto px-4 pt-3.5 pb-4">
        {comments === undefined ? (
          <Spinner />
        ) : comments.length === 0 ? (
          <p className="m-0 text-sm text-muted-foreground">No comments yet.</p>
        ) : (
          <ul className="m-0 grid list-none gap-3 p-0">
            {comments.map((c) => (
              <li key={c.id} className="flex gap-2.5">
                <PersonAvatar name={c.name} size="sm" me={c.mine} />
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <span className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{c.mine ? 'You' : c.name}</span>
                    {' · '}
                    {new Date(c.at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                  <p className="m-0 text-sm whitespace-pre-wrap">{c.body}</p>
                </div>
                {c.mine && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete comment"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => void remove.run({ commentId: c.id })}
                  >
                    <Trash2 />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <form
        className="grid gap-2 border-t px-4 py-3"
        onSubmit={async (event) => {
          event.preventDefault()
          if (!body.trim()) return
          if (await add.run({ expenseId, body })) setBody('')
        }}
      >
        <label htmlFor="comment-body" className="sr-only">
          Write a comment
        </label>
        <Textarea
          id="comment-body"
          value={body}
          maxLength={500}
          rows={2}
          autoFocus
          placeholder="Ask about it or add a note"
          onChange={(e) => setBody(e.target.value)}
        />
        {add.error && <FieldError>{add.error}</FieldError>}
        <Button type="submit" size="sm" className="justify-self-end" disabled={add.pending || !body.trim()}>
          {add.pending ? <Spinner /> : <Send />}
          Comment
        </Button>
      </form>
    </>
  )
}
