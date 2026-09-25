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
 * A pencil button that opens a form in a dialog, for editing a row in
 * place. `children` gets a `close` to call once the form has saved. The
 * form mounts on open, so it always starts from the row's current values.
 */
export function EditDialog({
  label,
  title,
  description,
  children,
}: {
  /** The button's accessible name, e.g. "Edit Groceries". */
  label: string
  title: string
  description?: React.ReactNode
  children: (close: () => void) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
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
      </DialogTrigger>
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
