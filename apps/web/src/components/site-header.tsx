'use client'

import Link from 'next/link'

import { AccountMenu } from '#/components/account-menu'
import { Logo } from '#/components/brand'
import { NavLink } from '#/components/nav-link'
import { useSession } from '#/components/providers'
import { ThemeToggle } from '#/components/theme-toggle'
import { buttonVariants } from '#/components/ui/button'
import { cn } from '#/lib/utils'

/**
 * The top bar of the signed-out pages (and of the "what's your name" step):
 * logo, settings, theme and, once signed in, the account menu. The signed-in
 * app has the sidebar instead (see app-shell.tsx).
 */
export function SiteHeader() {
  const { user } = useSession()

  return (
    <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-md">
      <div className="app-shell flex h-16 items-center justify-between gap-2">
        <Link href="/" className="no-underline" aria-label="Settlr, home">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1" aria-label="Main">
          {!user && (
            <NavLink
              href="/settings"
              className={cn(
                buttonVariants({ variant: 'ghost' }),
                'text-muted-foreground no-underline data-[status=active]:bg-tile data-[status=active]:text-foreground',
              )}
            >
              Settings
            </NavLink>
          )}
          <ThemeToggle />
          <AccountMenu />
        </nav>
      </div>
    </header>
  )
}
