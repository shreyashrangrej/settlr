'use client'

import { Moon, Sun } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { applyTheme } from '#/lib/theme'
import { cn } from '#/lib/utils'

export function ThemeToggle({ className }: { className?: string }) {
  function toggle() {
    const isDark = document.documentElement.classList.contains('dark')
    applyTheme(isDark ? 'light' : 'dark')
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
      <Sun className="dark:hidden" />
      <Moon className="hidden dark:block" />
    </Button>
  )
}
