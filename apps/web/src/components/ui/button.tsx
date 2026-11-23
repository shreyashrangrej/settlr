"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "#/lib/utils"

// Gr8r Studio's button (src/styles/components.css `.btn`): 30px tall, 6px
// radius, 12.5px medium text, 6px between icon and label, and a slight
// press scale. Primary is the indigo fill with a faint inner bottom edge;
// outline is Gr8r's secondary (the surface with a strong hairline and a
// small shadow); ghost is muted text that fills on hover. Below `sm`
// controls are a step taller, and touch screens get a 44px hit area.
const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap outline-none select-none transition-[background-color,border-color,color,box-shadow,scale] duration-140 [&:active:not([aria-haspopup]):not(:disabled)]:scale-[0.97] pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none aria-disabled:pointer-events-none aria-disabled:opacity-45 aria-invalid:border-destructive sm:text-ui [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:opacity-90 [&_svg:not([class*='size-'])]:size-4 sm:[&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[inset_0_-1px_0_rgb(0_0_0/12%)] hover:bg-[color-mix(in_srgb,var(--accent)_88%,var(--text))] active:bg-[color-mix(in_srgb,var(--accent)_78%,var(--text))]",
        // The "Settle" button: the text colour as a fill.
        contrast:
          "bg-contrast text-contrast-foreground hover:bg-contrast/88",
        outline:
          "border-input bg-card text-foreground shadow-xs hover:bg-muted active:bg-raised aria-expanded:bg-muted",
        secondary:
          "bg-muted text-foreground hover:bg-raised aria-expanded:bg-raised",
        ghost:
          "text-muted-foreground hover:bg-muted hover:text-foreground active:bg-raised aria-expanded:bg-raised aria-expanded:text-foreground",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-[color-mix(in_srgb,var(--owe)_88%,#000)]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8.5 px-3 sm:h-7.5 sm:px-[11px]",
        xs: "h-6.5 gap-1 rounded-sm px-2 text-xs sm:h-5.5 sm:px-1.5 sm:text-xs [&_svg:not([class*='size-'])]:size-3.5 sm:[&_svg:not([class*='size-'])]:size-3",
        sm: "h-7.5 px-2.5 text-xs sm:h-6.5 sm:px-2 sm:text-xs",
        lg: "h-10 px-3.5 text-sm sm:h-9 sm:text-sm",
        icon: "size-8.5 sm:size-7.5",
        "icon-xs":
          "size-6.5 rounded-sm sm:size-5.5 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-7.5 sm:size-6.5",
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
