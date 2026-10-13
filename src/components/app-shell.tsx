'use client'

import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Bell, Plus, Sparkles } from 'lucide-react'

import { AccountMenu } from '#/components/account-menu'
import { AddMenu } from '#/components/add-menu'
import { APP_SECTIONS } from '#/components/app-nav'
import { Logo } from '#/components/brand'
import { groupColor } from '#/components/category'
import { NavLink } from '#/components/nav-link'
import { NotificationBell } from '#/components/notification-bell'
import { useSession } from '#/components/providers'
import { SiteHeader } from '#/components/site-header'
import { ThemeToggle } from '#/components/theme-toggle'
import { buttonVariants } from '#/components/ui/button'
import { cn } from '#/lib/utils'
import { api } from '#convex/_generated/api'

// How many groups the sidebar lists; "All groups" has the rest.
const SIDEBAR_GROUPS = 6

const sectionLabel =
  'text-[0.6875rem] font-semibold tracking-[0.1em] text-faint uppercase'
const navItem =
  'flex min-h-11 items-center gap-3 rounded-xl px-3 font-medium text-soft no-underline outline-none hover:bg-tile/60 focus-visible:ring-3 focus-visible:ring-ring/50 data-[status=active]:bg-tile data-[status=active]:font-semibold data-[status=active]:text-foreground [&_svg]:size-[18px] [&_svg]:shrink-0 data-[status=active]:[&_svg]:text-primary'

/**
 * The frame around every page. Signed in, it's the sidebar (wide screens) or
 * a top bar and a floating tab bar (narrow ones) around a centred content
 * column; signed out, or while a new account still has to give its name,
 * it's just the top bar.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useSession()
  const signedIn = user !== null && user.name !== ''

  if (!signedIn) {
    return (
      <>
        <SiteHeader />
        <main className="app-shell">{children}</main>
      </>
    )
  }

  return (
    <div className="flex min-h-svh items-stretch">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileBar />
        <main className="min-w-0 flex-1 px-[clamp(1rem,2.6vw,2.25rem)] pt-4 pb-32 lg:pt-6 lg:pb-12">
          <div className="mx-auto w-full max-w-[1220px]">{children}</div>
        </main>
      </div>
      <MobileNav />
    </div>
  )
}

function Sidebar() {
  const { data: unread = 0 } = useQuery(convexQuery(api.notifications.unreadCount, {}))
  const { data: groups } = useQuery(convexQuery(api.groups.list, {}))

  return (
    <aside className="sticky top-0 hidden h-svh w-58 shrink-0 flex-col gap-7 overflow-y-auto border-r [scrollbar-width:none] border-divider bg-sidebar px-4 py-6 lg:flex">
      <Link href="/dashboard" className="px-2 no-underline" aria-label="Settlr, dashboard">
        <Logo />
      </Link>

      <nav aria-label="Main" className="grid gap-0.5">
        <p className={cn(sectionLabel, 'mb-1.5 px-3')}>Menu</p>
        {APP_SECTIONS.map((section) => (
          <NavLink key={section.to} href={section.to} exact={section.exact} className={navItem}>
            <section.icon />
            {section.label}
          </NavLink>
        ))}
        <NavLink href="/notifications" className={navItem}>
          <Bell />
          <span className="flex-1">Notifications</span>
          {unread > 0 && (
            <span className="grid h-5.5 min-w-5.5 place-items-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground tabular-nums">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </NavLink>
      </nav>

      <div className="grid gap-0.5">
        <div className="flex items-center justify-between pr-1 pb-1.5 pl-3">
          <p className={sectionLabel}>Groups</p>
          <Link
            href="/groups/new"
            aria-label="New group"
            title="New group"
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
              'size-8 text-muted-foreground',
            )}
          >
            <Plus />
          </Link>
        </div>
        {groups?.slice(0, SIDEBAR_GROUPS).map((group) => (
          <NavLink
            key={group.id}
            href={`/groups/${group.id}`}
            className="flex min-h-10 items-center gap-2.5 rounded-[10px] px-3 text-soft no-underline outline-none hover:bg-tile/60 focus-visible:ring-3 focus-visible:ring-ring/50 data-[status=active]:bg-tile data-[status=active]:text-foreground"
          >
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full"
              style={{ background: groupColor(group.id) }}
            />
            <span className="min-w-0 flex-1 truncate">{group.name}</span>
            {group.myNetCents !== 0 && (
              <span
                className={cn(
                  'font-mono text-xs tabular-nums',
                  group.myNetCents > 0 ? 'text-positive' : 'text-destructive',
                )}
              >
                {group.myNetCents > 0 ? '+' : '−'}
                {compact(group.myNetCents)}
              </span>
            )}
          </NavLink>
        ))}
        {groups?.length === 0 && (
          <p className="px-3 text-[0.8125rem] text-muted-foreground">No groups yet.</p>
        )}
        {groups && groups.length > SIDEBAR_GROUPS && (
          <Link
            href="/groups"
            className="px-3 py-2 text-[0.8125rem] text-muted-foreground no-underline hover:text-foreground"
          >
            All {groups.length} groups
          </Link>
        )}
      </div>

      <div className="mt-auto grid gap-3">
        <div className="grid gap-2.5 rounded-2xl border bg-card p-4">
          <span className="flex items-center gap-2 font-semibold">
            <Sparkles className="size-4 text-primary" aria-hidden="true" />
            Add it by typing
          </span>
          <span className="text-[0.8125rem] leading-[1.45] text-muted-foreground">
            Tell the assistant what you spent and who shared it.
          </span>
          <Link
            href="/assistant"
            className={cn(buttonVariants({ variant: 'outline' }), 'no-underline')}
          >
            Ask the assistant
          </Link>
        </div>
        <div className="flex items-center gap-1">
          <AccountMenu variant="row" />
          <ThemeToggle />
        </div>
      </div>
    </aside>
  )
}

// The whole units of an amount for the sidebar, e.g. 341000 → "3,410".
function compact(cents: number) {
  return Math.round(Math.abs(cents) / 100).toLocaleString('en-US')
}

/** Narrow screens: logo, bell, theme and account above the page. */
function MobileBar() {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-2 bg-background/85 px-4 backdrop-blur-md lg:hidden">
      <Link href="/dashboard" className="no-underline" aria-label="Settlr, dashboard">
        <Logo />
      </Link>
      <div className="flex items-center gap-1">
        <NotificationBell />
        <ThemeToggle />
        <AccountMenu />
      </div>
    </header>
  )
}

const tab =
  'flex min-h-13 flex-col items-center justify-center gap-0.5 rounded-2xl text-[0.625rem] font-medium text-muted-foreground no-underline outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-[status=active]:font-semibold data-[status=active]:text-primary [&_svg]:size-[21px]'

/** Narrow screens: the floating pill of tabs, with Add in the middle. */
function MobileNav() {
  const tabs = APP_SECTIONS.filter((section) => section.mobile)
  const half = Math.ceil(tabs.length / 2)
  const link = (section: (typeof tabs)[number]) => (
    <NavLink key={section.to} href={section.to} exact={section.exact} className={tab}>
      <section.icon />
      {section.short}
    </NavLink>
  )

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 bg-linear-to-b from-transparent to-background to-55% px-4.5 pt-10 pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden">
      <nav
        aria-label="Main"
        className="pointer-events-auto mx-auto grid h-16.5 max-w-md grid-cols-5 items-center rounded-[33px] border border-input bg-tile px-2 shadow-[0_12px_30px_rgba(0,0,0,0.45)]"
      >
        {tabs.slice(0, half).map(link)}
        <div className="grid place-items-center">
          <AddMenu
            side="top"
            trigger={
              <button
                type="button"
                aria-label="Add expense"
                className="grid size-12.5 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_6px_18px_rgba(177,140,255,0.3)] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            }
          >
            <Plus className="size-5.5" strokeWidth={2.6} />
          </AddMenu>
        </div>
        {tabs.slice(half).map(link)}
      </nav>
    </div>
  )
}
