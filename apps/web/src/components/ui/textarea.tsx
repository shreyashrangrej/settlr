import * as React from "react"
import { cn } from "#/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-18 w-full rounded-lg px-2.5 py-2 leading-normal border border-input bg-field text-lg text-foreground transition-[border-color,box-shadow] duration-140 outline-none placeholder:text-faint hover:border-[color-mix(in_srgb,var(--border-strong)_60%,var(--faint))] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-soft disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:text-faint aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/10 sm:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
