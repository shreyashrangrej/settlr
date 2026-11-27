'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import { AccountMenu } from '#/components/account-menu'
import { Logo } from '#/components/brand'
import { NavLink } from '#/components/nav-link'
import { useSession } from '#/components/providers'
import { ThemeToggle } from '#/components/theme-toggle'
import { buttonVariants } from '#/components/ui/button'
import { DOCS_URL } from '#/lib/site'
import { cn } from '#/lib/utils'

/**
 * The top bar of the signed-out pages (and of the "what's your name" step):
 * logo, docs, settings, theme and, once signed in, the account menu. The signed-in
 * app has the sidebar instead (see app-shell.tsx). It has no edge: at the top
 * of the page it's see-through (the home page's backdrop runs up behind it),
 * and once the page scrolls under it, it frosts over with a soft shadow.
 */
export function SiteHeader() {
  const { user } = useSession()
  const scrolled = useScrolled()

  return (
    <header
      data-scrolled={scrolled || undefined}
      className="sticky top-0 z-40 transition-[background-color,box-shadow] duration-200 ease-out-quint data-scrolled:bg-background/80 data-scrolled:shadow-[0_12px_32px_-24px_rgb(28_25_20/35%)] data-scrolled:backdrop-blur-lg dark:data-scrolled:shadow-[0_12px_32px_-20px_rgb(0_0_0/80%)]"
    >
      <div className="app-shell flex h-12 items-center justify-between gap-2">
        <Link href="/" className="no-underline" aria-label="Settlr, home">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1" aria-label="Main">
          <a
            href={DOCS_URL}
            className={cn(buttonVariants({ variant: 'ghost' }), 'text-muted-foreground no-underline')}
          >
            Docs
          </a>
          {!user && (
            <NavLink
              href="/settings"
              className={cn(
                buttonVariants({ variant: 'ghost' }),
                'text-muted-foreground no-underline data-[status=active]:bg-accent data-[status=active]:text-foreground',
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

/** Whether the window has scrolled away from the top. False on the server. */
function useScrolled() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 4)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])
  return scrolled
}
