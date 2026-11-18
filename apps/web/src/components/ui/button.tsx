"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "#/lib/utils"

// T3 Code's button (apps/web/src/components/ui/button.tsx): 8px radius,
// medium weight, a 1px inner highlight on filled and outline buttons, a
// slight press scale, and a 44px hit area on touch screens. Controls are a
// step taller below `sm`, where text is 16px so iOS doesn't zoom.
const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border bg-clip-padding text-base font-medium whitespace-nowrap outline-none select-none transition-[box-shadow,scale,background-color,color] [&:active:not([aria-haspopup]):not(:disabled)]:scale-[0.97] before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-64 aria-disabled:cursor-not-allowed aria-disabled:opacity-64 aria-invalid:border-destructive/36 sm:text-sm [&_svg]:pointer-events-none [&_svg]:-mx-0.5 [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-primary bg-primary text-primary-foreground shadow-xs shadow-primary/24 not-disabled:inset-shadow-[0_1px_--theme(--color-white/16%)] hover:bg-primary/90 active:inset-shadow-[0_1px_--theme(--color-black/8%)] [:disabled,:active]:shadow-none",
        // The light "Settle" button: the text colour as a fill.
        contrast:
          "border-contrast bg-contrast text-contrast-foreground shadow-xs/5 hover:bg-contrast/88 [:disabled,:active]:shadow-none",
        outline:
          "border-input bg-popover text-foreground shadow-xs/5 not-dark:bg-clip-padding not-disabled:not-active:before:shadow-[0_1px_--theme(--color-black/4%)] hover:bg-accent/50 aria-expanded:bg-accent/50 dark:bg-field dark:not-disabled:not-active:before:shadow-[0_-1px_--theme(--color-white/6%)] dark:hover:bg-input/64 dark:aria-expanded:bg-input/64 [:disabled,:active]:shadow-none [&_svg:not([class*='text-'])]:text-muted-foreground",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/90 active:bg-secondary/80 aria-expanded:bg-secondary/80 dark:hover:bg-input/64",
        ghost:
          "border-transparent text-foreground hover:bg-accent aria-expanded:bg-accent [&_svg:not([class*='text-'])]:text-muted-foreground",
        destructive:
          "border-destructive bg-destructive text-destructive-foreground shadow-xs shadow-destructive/24 not-disabled:inset-shadow-[0_1px_--theme(--color-white/16%)] hover:bg-destructive/90 active:inset-shadow-[0_1px_--theme(--color-black/8%)] [:disabled,:active]:shadow-none",
        link: "border-transparent text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-[calc(--spacing(3)-1px)] sm:h-8",
        xs: "h-7 gap-1 rounded-md px-[calc(--spacing(2)-1px)] text-sm before:rounded-[calc(var(--radius-md)-1px)] sm:h-6 sm:text-xs [&_svg:not([class*='size-'])]:size-4 sm:[&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-8 gap-1.5 px-[calc(--spacing(2.5)-1px)] sm:h-7",
        lg: "h-10 px-[calc(--spacing(3.5)-1px)] sm:h-9",
        icon: "size-9 sm:size-8",
        "icon-xs":
          "size-7 rounded-md before:rounded-[calc(var(--radius-md)-1px)] sm:size-6 [&_svg:not([class*='size-'])]:size-4 sm:[&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-8 sm:size-7",
        "icon-lg": "size-10 sm:size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
