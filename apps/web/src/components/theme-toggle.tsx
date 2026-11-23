'use client'

import { Moon, Sun } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { applyTheme, originOf } from '#/lib/theme'
import { cn } from '#/lib/utils'

/**
 * Light/dark switch, in the signed-out header and the app's top bar. It
 * saves an explicit choice (Settings → Appearance → Theme → System goes
 * back to following the device), and the new theme spreads out from the
 * button in a circle (`applyTheme`).
 */
export function ThemeToggle({ className }: { className?: string }) {
  function toggle(event: React.MouseEvent<HTMLButtonElement>) {
    const isDark = document.documentElement.classList.contains('dark')
    applyTheme(isDark ? 'light' : 'dark', originOf(event))
  }

  // Both icons are rendered and swapped with the `dark:` variant, so the
  // server HTML matches the client whatever the theme is.
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
      className={cn('text-muted-foreground', className)}
    >
      {/* 16px, like the bell beside it in the top bar. */}
      <Sun className="size-4 dark:hidden" />
      <Moon className="hidden size-4 dark:block" />
    </Button>
  )
}
