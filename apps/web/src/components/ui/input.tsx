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
        "h-9 w-full min-w-0 px-[calc(--spacing(3)-1px)] sm:h-8 file:me-3 file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground rounded-lg border border-input bg-field text-base text-foreground shadow-xs/5 transition-shadow outline-none not-dark:bg-clip-padding placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/24 focus-visible:ring-inset disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-64 aria-invalid:border-destructive/36 focus-visible:aria-invalid:border-destructive/64 focus-visible:aria-invalid:ring-destructive/16 sm:text-sm dark:aria-invalid:ring-destructive/24 [&:disabled,&:focus-visible,&[aria-invalid=true]]:shadow-none",
        className
      )}
      {...props}
    />
  )
}

export { Input }
