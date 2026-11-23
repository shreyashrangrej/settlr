import { cn } from "#/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("rounded-md bg-skeleton skeleton-shimmer motion-safe:animate-skeleton", className)}
      {...props}
    />
  )
}

export { Skeleton }
