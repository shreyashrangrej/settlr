import * as React from 'react'

import { cn } from '#/lib/utils'

// A styled native <select>: matches `Input`, keeps the platform picker and
// works before hydration.
function NativeSelect({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        'h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        'aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  )
}

export { NativeSelect }
