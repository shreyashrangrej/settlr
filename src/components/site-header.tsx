'use client'

import Link from 'next/link'

import { AccountMenu } from '#/components/account-menu'
import { APP_SECTIONS } from '#/components/app-nav'
import { NavLink } from '#/components/nav-link'
import { NotificationBell } from '#/components/notification-bell'
import { useSession } from '#/components/providers'
import { ThemeToggle } from '#/components/theme-toggle'
import { buttonVariants } from '#/components/ui/button'
import { cn } from '#/lib/utils'

const navLink = cn(
  buttonVariants({ variant: 'ghost' }),
  'text-muted-foreground no-underline data-[status=active]:bg-muted data-[status=active]:text-foreground',
)

/** The sticky top bar: logo, sections (wide screens), bell, theme, account. */
export function SiteHeader() {
  const { user } = useSession()
  // New email-code accounts are asked for their name before anything else.
  const needsName = user !== null && user.name === ''

  return (
    <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-md">
      <div className="app-shell flex h-14 items-center justify-between gap-2">
        <Link
          href={user ? '/dashboard' : '/'}
          className="text-lg font-bold tracking-tight text-primary no-underline"
        >
          Settlr
        </Link>
        <nav className="flex items-center gap-1" aria-label="Main">
          {user && !needsName && (
            // On small screens the app layout shows these as tabs.
            <div className="hidden items-center gap-1 md:flex">
              {APP_SECTIONS.map((section) => (
                <NavLink
                  key={section.to}
                  href={section.to}
                  exact={section.exact}
                  className={navLink}
                >
                  {section.label}
                </NavLink>
              ))}
            </div>
          )}
          {/* Signed in, Settings is in the account menu. */}
          {!user && (
            <NavLink href="/settings" className={navLink}>
              Settings
            </NavLink>
          )}
          {user && !needsName && <NotificationBell />}
          <ThemeToggle />
          <AccountMenu />
        </nav>
      </div>
    </header>
  )
}
