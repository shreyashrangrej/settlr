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
 * element that opens it (a Base UI `render` element, e.g. a Button); or
 * leave it out and pass `open`/`onOpenChange` to open it from elsewhere (a
 * row's menu). `onConfirm` resolves to true when it worked; the dialog then
 * closes.
 */
export function ConfirmAction({
  trigger,
  open: controlledOpen,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Delete',
  onConfirm,
}: {
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title: string
  description: React.ReactNode
  confirmLabel?: string
  onConfirm: () => Promise<boolean>
}) {
  const [ownOpen, setOwnOpen] = useState(false)
  const controlled = controlledOpen !== undefined
  const open = controlled ? controlledOpen : ownOpen
  const setOpen = (next: boolean) => (controlled ? onOpenChange?.(next) : setOwnOpen(next))
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
      {trigger && <AlertDialogTrigger render={trigger} />}
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
