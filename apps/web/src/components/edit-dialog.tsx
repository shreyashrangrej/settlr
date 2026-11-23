'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'

import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog'

/**
 * A form in a dialog, for editing a row in place: a pencil button opens it,
 * or pass `open`/`onOpenChange` to open it from elsewhere (a row's menu),
 * which drops the button. `children` gets a `close` to call once the form
 * has saved. The form mounts on open, so it always starts from the row's
 * current values.
 */
export function EditDialog({
  label,
  title,
  description,
  open: controlledOpen,
  onOpenChange,
  children,
}: {
  /** The button's accessible name, e.g. "Edit Groceries". */
  label?: string
  title: string
  description?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: (close: () => void) => React.ReactNode
}) {
  const [ownOpen, setOwnOpen] = useState(false)
  const controlled = controlledOpen !== undefined
  const open = controlled ? controlledOpen : ownOpen
  const setOpen = (next: boolean) => (controlled ? onOpenChange?.(next) : setOwnOpen(next))
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!controlled && <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            title="Edit"
            className="text-muted-foreground hover:text-foreground"
          />
        }
      >
        <Pencil />
      </DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children(() => setOpen(false))}
      </DialogContent>
    </Dialog>
  )
}
