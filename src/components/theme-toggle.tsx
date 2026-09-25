import { useEffect } from 'react'
import { Moon, Sun } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { applyTheme, readStoredTheme } from '#/lib/theme'

export function ThemeToggle() {
  // Until the viewer picks a theme, keep following the OS setting live.
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (!readStoredTheme()) {
        applyTheme(query.matches ? 'dark' : 'light', { persist: false })
      }
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  function toggle() {
    const isDark = document.documentElement.classList.contains('dark')
    applyTheme(isDark ? 'light' : 'dark', { persist: true })
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
    >
      <Sun className="dark:hidden" />
      <Moon className="hidden dark:block" />
    </Button>
  )
}
