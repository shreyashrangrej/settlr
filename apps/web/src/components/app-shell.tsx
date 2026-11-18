'use client'

import { useCallback, useEffect, useState } from 'react'
import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Bell, PanelLeftClose, PanelLeftOpen, Plus, Sparkles } from 'lucide-react'

import { AccountMenu } from '#/components/account-menu'
import { AddMenu } from '#/components/add-menu'
import { APP_SECTIONS } from '#/components/app-nav'
import { Logo, LogoMark } from '#/components/brand'
import { groupColor } from '#/components/category'
import { NavLink } from '#/components/nav-link'
import { NotificationBell } from '#/components/notification-bell'
import { useSession } from '#/components/providers'
import { SiteHeader } from '#/components/site-header'
import { Button, buttonVariants } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import { formatMoney, formatWholeMoney } from '@settlr/shared/format'
import { SIDEBAR_COOKIE } from '#/lib/sidebar'
import { cn } from '#/lib/utils'
import { api } from '@settlr/backend/convex/_generated/api'

// How many groups the sidebar lists; "All groups" has the rest.
const SIDEBAR_GROUPS = 6

// T3 Code's sidebar: 32px rows, muted icons, a quiet fill on hover and a
// slightly stronger one (white, raised, in light mode) on the current page.
const sectionLabel = 'text-xs font-medium text-muted-foreground'
const row =
  'text-sm text-foreground no-underline outline-none hover:bg-foreground/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset data-[status=active]:bg-foreground/8 data-[status=active]:font-medium data-[status=active]:text-foreground not-dark:data-[status=active]:bg-card not-dark:data-[status=active]:shadow-xs/5 not-dark:data-[status=active]:ring-1 not-dark:data-[status=active]:ring-border/70'
const navItem = cn(
  'flex h-8 items-center gap-2 rounded-lg [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground hover:[&_svg]:text-foreground data-[status=active]:[&_svg]:text-foreground',
  row,
)

/**
 * The frame around every page. Signed in, it's the sidebar (wide screens) or
 * a top bar and a floating tab bar (narrow ones) around the content, which
 * takes the rest of the width; signed out, or while a new account still has
 * to give its name, it's just the top bar. `sidebarCollapsed` is the
 * viewer's choice, read from a cookie on the server so the first render
 * already has the right width.
 */
export function AppShell({
  children,
  sidebarCollapsed,
}: {
  children: React.ReactNode
  sidebarCollapsed: boolean
}) {
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
      <Sidebar initialCollapsed={sidebarCollapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileBar />
        <main className="min-w-0 flex-1 px-5 pt-5 pb-32 sm:px-6 lg:pt-6 lg:pb-12">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  )
}

/** Collapsed or not, remembered in a cookie; Ctrl/⌘+B toggles it. */
function useCollapsed(initial: boolean) {
  const [collapsed, setCollapsed] = useState(initial)
  const toggle = useCallback(() => {
    setCollapsed((current) => {
      const next = !current
      document.cookie = `${SIDEBAR_COOKIE}=${next ? 'collapsed' : 'open'}; path=/; max-age=31536000; samesite=lax`
      return next
    })
  }, [])
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key.toLowerCase() === 'b' && (event.metaKey || event.ctrlKey) && !event.altKey) {
        event.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])
  return [collapsed, toggle] as const
}

/**
 * Wide screens: the sections, your groups and your account. Collapsed, it's
 * a rail of icons (names in their tooltips), and groups are colour tiles.
 */
function Sidebar({ initialCollapsed }: { initialCollapsed: boolean }) {
  const [collapsed, toggle] = useCollapsed(initialCollapsed)
  const { data: unread = 0 } = useQuery(convexQuery(api.notifications.unreadCount, {}))
  const { data: groups } = useQuery(convexQuery(api.groups.list, {}))
  const item = cn(navItem, collapsed ? 'justify-center px-0' : 'px-2.5')
  const toggleLabel = collapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'

  return (
    <aside
      data-collapsed={collapsed || undefined}
      className={cn(
        'sticky top-0 hidden h-svh shrink-0 flex-col gap-5 overflow-x-hidden overflow-y-auto border-r [scrollbar-width:none] bg-sidebar py-3 lg:flex',
        collapsed ? 'w-18 px-3' : 'w-58 px-2.5',
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2',
          collapsed ? 'flex-col' : 'h-10 justify-between pl-1.5',
        )}
      >
        <Link href="/dashboard" className="no-underline" aria-label="Settlr, dashboard">
          {collapsed ? <LogoMark /> : <Logo />}
        </Link>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggle}
          aria-label={toggleLabel}
          title={toggleLabel}
          className="text-muted-foreground"
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </Button>
      </div>

      <nav aria-label="Main" className="grid gap-0.5">
        {!collapsed && <p className={cn(sectionLabel, 'flex h-7 items-center px-2.5')}>Menu</p>}
        {APP_SECTIONS.map((section) => (
          <NavLink
            key={section.to}
            href={section.to}
            exact={section.exact}
            className={item}
            title={collapsed ? section.label : undefined}
          >
            <section.icon />
            <span className={cn(collapsed && 'sr-only')}>{section.label}</span>
          </NavLink>
        ))}
        <NavLink
          href="/notifications"
          className={cn(item, 'relative')}
          title={collapsed ? 'Notifications' : undefined}
        >
          <Bell />
          <span className={cn(collapsed ? 'sr-only' : 'flex-1')}>
            Notifications
            {collapsed && unread > 0 && ` (${unread} unread)`}
          </span>
          {unread > 0 &&
            (collapsed ? (
              <span
                aria-hidden="true"
                className="absolute top-1.5 right-2.5 size-1.5 rounded-full bg-primary"
              />
            ) : (
              <span className="grid h-4.5 min-w-4.5 place-items-center rounded-sm bg-primary px-1 text-2xs font-medium text-primary-foreground tabular-nums">
                {unread > 99 ? '99+' : unread}
              </span>
            ))}
        </NavLink>
      </nav>

      <div className="grid gap-0.5">
        <div
          className={cn(
            'flex items-center',
            collapsed ? 'justify-center pb-1' : 'h-7 justify-between pr-0.5 pl-2.5',
          )}
        >
          {!collapsed && <p className={sectionLabel}>Groups</p>}
          <Link
            href="/groups/new"
            aria-label="New group"
            title="New group"
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'icon-xs' }),
              'text-muted-foreground',
            )}
          >
            <Plus />
          </Link>
        </div>
        {groups?.slice(0, SIDEBAR_GROUPS).map((group) => {
          const balance =
            group.myNetCents > 0
              ? `You’re owed ${formatMoney(group.myNetCents, group.currency)}`
              : group.myNetCents < 0
                ? `You owe ${formatMoney(-group.myNetCents, group.currency)}`
                : 'You’re square'
          return collapsed ? (
            <NavLink
              key={group.id}
              href={`/groups/${group.id}`}
              title={`${group.name} · ${balance}`}
              className={cn('grid h-9 place-items-center rounded-lg', row)}
            >
              <span
                className="grid size-6 place-items-center rounded-md text-2xs font-medium text-on-fill uppercase"
                style={{ background: groupColor(group.id) }}
              >
                <span aria-hidden="true">{group.name.charAt(0)}</span>
                <span className="sr-only">{group.name}</span>
              </span>
            </NavLink>
          ) : (
            <NavLink
              key={group.id}
              href={`/groups/${group.id}`}
              className={cn('flex h-8 items-center gap-2.5 rounded-lg px-2.5', row)}
            >
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-[3px]"
                style={{ background: groupColor(group.id) }}
              />
              <span className="min-w-0 flex-1 truncate">{group.name}</span>
              {group.myNetCents !== 0 && (
                <span
                  className={cn(
                    'text-xs font-medium tabular-nums',
                    group.myNetCents > 0 ? 'text-positive' : 'text-destructive',
                  )}
                  title={balance}
                >
                  {group.myNetCents > 0 ? '+' : '−'}
                  {formatWholeMoney(Math.abs(group.myNetCents), group.currency)}
                </span>
              )}
            </NavLink>
          )
        })}
        {/* Loads in the browser; hold the space so the list doesn't jump in. */}
        {!groups &&
          [0, 1, 2].map((i) =>
            collapsed ? (
              <div key={i} className="grid h-9 place-items-center">
                <Skeleton className="size-6 rounded-md" />
              </div>
            ) : (
              <div key={i} className="flex h-8 items-center gap-2.5 px-2.5">
                <Skeleton className="size-2 rounded-[3px]" />
                <Skeleton className="h-3.5 flex-1 rounded" />
              </div>
            ),
          )}
        {!collapsed && groups?.length === 0 && (
          <p className="px-2.5 py-1.5 text-xs text-muted-foreground">No groups yet.</p>
        )}
        {!collapsed && groups && groups.length > SIDEBAR_GROUPS && (
          <Link
            href="/groups"
            className="flex h-8 items-center px-2.5 text-xs text-muted-foreground no-underline hover:text-foreground"
          >
            All {groups.length} groups
          </Link>
        )}
      </div>

      {/* minmax(0,1fr): the column stays the sidebar's width instead of
          growing to fit the account name. */}
      <div className="mt-auto grid grid-cols-[minmax(0,1fr)] gap-2">
        {/* Dropped when collapsed (Assistant is in the menu) and on short
            screens, where the lists above need the room. */}
        {!collapsed && (
          <div className="mx-0.5 grid gap-2 rounded-xl border bg-card p-3 shadow-xs/5 [@media(max-height:56rem)]:hidden">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="size-4 text-primary" aria-hidden="true" />
              Add it by typing
            </span>
            <span className="text-xs leading-[1.45] text-muted-foreground">
              Tell the assistant what you spent and who shared it.
            </span>
            <Link
              href="/assistant"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-0.5 no-underline')}
            >
              Ask the assistant
            </Link>
          </div>
        )}
        {/* The theme switch is in the account menu. */}
        <AccountMenu variant={collapsed ? 'compact' : 'row'} />
      </div>
    </aside>
  )
}

/**
 * Narrow screens: logo, bell and account above the page. The theme toggle
 * is in the account menu here.
 */
function MobileBar() {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-2 border-b surface-glass px-4 lg:hidden">
      <Link href="/dashboard" className="no-underline" aria-label="Settlr, dashboard">
        <Logo />
      </Link>
      <div className="flex items-center gap-1">
        <NotificationBell />
        <AccountMenu />
      </div>
    </header>
  )
}

const tab =
  'flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg text-3xs font-medium text-muted-foreground no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset data-[status=active]:text-foreground [&_svg]:size-5'

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
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 bg-linear-to-b from-transparent to-background to-55% px-4 pt-10 pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden">
      <nav
        aria-label="Main"
        className="pointer-events-auto mx-auto grid h-15 max-w-md grid-cols-5 items-center rounded-2xl dropdown-glass px-1.5"
      >
        {tabs.slice(0, half).map(link)}
        <div className="grid place-items-center">
          <AddMenu
            side="top"
            trigger={
              <button
                type="button"
                aria-label="Add expense"
                className="grid size-11 place-items-center rounded-xl border border-primary bg-primary text-primary-foreground shadow-xs shadow-primary/24 inset-shadow-[0_1px_--theme(--color-white/16%)] outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              />
            }
          >
            <Plus className="size-5" strokeWidth={2.25} />
          </AddMenu>
        </div>
        {tabs.slice(half).map(link)}
      </nav>
    </div>
  )
}
