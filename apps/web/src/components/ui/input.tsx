"use client"

import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "#/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-lg px-2.5 sm:h-7.5 file:me-3 file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground border border-input bg-field text-lg text-foreground transition-[border-color,box-shadow] duration-140 outline-none placeholder:text-faint hover:border-[color-mix(in_srgb,var(--border-strong)_60%,var(--faint))] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-soft disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:text-faint aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/10 sm:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
