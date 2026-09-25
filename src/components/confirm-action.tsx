'use client'

import { useState } from 'react'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '#/components/ui/alert-dialog'
import { Button } from '#/components/ui/button'
import { Spinner } from '#/components/ui/spinner'

/**
 * A destructive action behind a confirmation dialog. `trigger` is the
 * element that opens it (a Base UI `render` element, e.g. a Button).
 * `onConfirm` resolves to true when it worked; the dialog then closes.
 */
export function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel = 'Delete',
  onConfirm,
}: {
  trigger: React.ReactElement
  title: string
  description: React.ReactNode
  confirmLabel?: string
  onConfirm: () => Promise<boolean>
}) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setPending(true)
    try {
      if (await onConfirm()) setOpen(false)
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button variant="destructive" disabled={pending} onClick={confirm}>
            {pending && <Spinner />}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
