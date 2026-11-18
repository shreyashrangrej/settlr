"use client"

import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "#/lib/utils"

const badgeVariants = cva(
  "group/badge relative inline-flex h-5.5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border border-transparent px-[calc(--spacing(1.5)-1px)] text-sm font-medium sm:h-5 sm:text-xs whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3! [&>svg]:opacity-80",
  {
    variants: {
      variant: {
        default: "bg-primary/8 text-primary dark:bg-primary/16 [a]:hover:bg-primary/16",
        secondary:
          "bg-foreground/6 text-foreground dark:bg-foreground/8 [a]:hover:bg-foreground/10",
        destructive:
          "bg-destructive/8 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/16 [a]:hover:bg-destructive/20",
        outline:
          "border-input bg-background text-foreground dark:bg-field [a]:hover:bg-accent/50",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
