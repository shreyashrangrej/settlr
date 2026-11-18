import * as React from "react"
import { cn } from "#/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full px-[calc(--spacing(3)-1px)] py-[calc(--spacing(1.5)-1px)] rounded-lg border border-input bg-field text-base text-foreground shadow-xs/5 transition-shadow outline-none not-dark:bg-clip-padding placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/24 focus-visible:ring-inset disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-64 aria-invalid:border-destructive/36 focus-visible:aria-invalid:border-destructive/64 focus-visible:aria-invalid:ring-destructive/16 sm:text-sm dark:aria-invalid:ring-destructive/24 [&:disabled,&:focus-visible,&[aria-invalid=true]]:shadow-none",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
