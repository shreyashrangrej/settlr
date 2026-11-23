'use client'

import { useState } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog'

/**
 * A header button (`trigger`, a Base UI `render` element such as a Button,
 * with `label` as its content) that opens a form in a dialog: "Add expense"
 * and "Settle up" on the expense pages. `children` gets a `close` to call
 * once the form has saved, and mounts on open, so it starts fresh. Pass
 * `defaultOpen` to open it on load (e.g. from a `?tab=payment` link).
 */
export function FormDialog({
  trigger,
  label,
  title,
  description,
  defaultOpen = false,
  children,
}: {
  trigger: React.ReactElement
  label: React.ReactNode
  title: string
  description?: React.ReactNode
  defaultOpen?: boolean
  children: (close: () => void) => React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger}>{label}</DialogTrigger>
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
