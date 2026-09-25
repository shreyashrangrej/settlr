'use client'

import { useRef, useState } from 'react'
import { useConvexMutation } from '@convex-dev/react-query'
import Link from 'next/link'
import { FileText, Paperclip, X } from 'lucide-react'

import { Button, buttonVariants } from '#/components/ui/button'
import { FieldError } from '#/components/ui/field'
import { Spinner } from '#/components/ui/spinner'
import { errorMessage } from '#/lib/errors'
import { MAX_RECEIPT_BYTES, RECEIPT_TYPES } from '#/lib/schemas'
import { cn } from '#/lib/utils'
import { api } from '#convex/_generated/api'
import type { Id } from '#convex/_generated/dataModel'

// Receipts: an image or PDF attached to an expense, kept in Convex file
// storage. Forms upload the file as soon as it's picked and send the
// receipt's id with the expense (see convex/receipts.ts).

export type ReceiptSource = 'personal' | 'friend' | 'group'

/**
 * A form's receipt: the one already on the expense (no name known), or a
 * new upload (`fresh`, not attached to anything until the form is saved).
 */
export type ReceiptValue = {
  id: Id<'receipts'>
  name: string | null
  fresh: boolean
} | null

/** The receipt already on an expense, as a form's starting value. */
export function existingReceipt(id: Id<'receipts'> | null | undefined): ReceiptValue {
  return id ? { id, name: null, fresh: false } : null
}

/** Picks, uploads, replaces or removes an expense's receipt. */
export function ReceiptField({
  id,
  value,
  onChange,
}: {
  id: string
  value: ReceiptValue
  onChange: (value: ReceiptValue) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const generateUploadUrl = useConvexMutation(api.receipts.generateUploadUrl)
  const createReceipt = useConvexMutation(api.receipts.create)
  const discard = useConvexMutation(api.receipts.discard)

  // A fresh upload isn't attached to anything, so drop it right away.
  function release(current: ReceiptValue) {
    if (current?.fresh) void discard({ receiptId: current.id }).catch(() => {})
  }

  async function upload(file: File) {
    setError(null)
    if (!(RECEIPT_TYPES as ReadonlyArray<string>).includes(file.type)) {
      setError('Choose an image (JPEG, PNG, WebP or GIF) or a PDF.')
      return
    }
    if (file.size > MAX_RECEIPT_BYTES) {
      setError('Receipts can be up to 10 MB.')
      return
    }
    setPending(true)
    try {
      const url = await generateUploadUrl({})
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!response.ok) throw new Error('The upload failed. Try again.')
      const { storageId } = (await response.json()) as { storageId: Id<'_storage'> }
      const created = await createReceipt({ storageId, fileName: file.name })
      if (created.error !== null) {
        setError(created.error)
        return
      }
      const { receiptId } = created
      release(value)
      onChange({ id: receiptId, name: file.name, fresh: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="grid gap-2">
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={RECEIPT_TYPES.join(',')}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void upload(file)
        }}
      />
      {value ? (
        <div className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm">
          <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{value.name ?? 'Receipt attached'}</span>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
          >
            {pending && <Spinner />}
            Replace
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Remove receipt"
            disabled={pending}
            onClick={() => {
              release(value)
              onChange(null)
            }}
          >
            <X />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="justify-start font-normal text-muted-foreground"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          {pending ? <Spinner /> : <Paperclip />}
          {pending ? 'Uploading…' : 'Attach a receipt (image or PDF)'}
        </Button>
      )}
      {error && <FieldError>{error}</FieldError>}
    </div>
  )
}

/** A paperclip that opens an expense's receipt in the receipt viewer. */
export function ReceiptLink({
  source,
  expenseId,
  className,
}: {
  source: ReceiptSource
  expenseId: string
  className?: string
}) {
  return (
    <Link
      href={`/receipts/${source}/${expenseId}`}
      aria-label="View receipt"
      title="View receipt"
      className={cn(
        buttonVariants({ variant: 'ghost', size: 'icon-xs' }),
        'shrink-0 text-muted-foreground hover:text-foreground',
        className,
      )}
    >
      <Paperclip />
    </Link>
  )
}
