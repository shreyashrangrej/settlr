'use client'

import { useCallback, useEffect, useState } from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Bell,
  ChevronDown,
  CircleHelp,
  Ellipsis,
  Menu,
  PanelLeft,
  Plus,
  Settings,
  Users,
} from 'lucide-react'

import { AccountMenu } from '#/components/account-menu'
import { AddMenu } from '#/components/add-menu'
import { APP_SECTIONS, sectionFor } from '#/components/app-nav'
import { LogoMark } from '#/components/brand'
import { groupColor, labelTint } from '#/components/category'
import { NavLink } from '#/components/nav-link'
import { NotificationBell } from '#/components/notification-bell'
import { useSession } from '#/components/providers'
import { SiteHeader } from '#/components/site-header'
import { Button, buttonVariants } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import { formatMoney, formatWholeMoney } from '@settlr/shared/format'
import { SIDEBAR_COOKIE } from '#/lib/sidebar'
import { DOCS_URL } from '#/lib/site'
import { cn } from '#/lib/utils'
import { api } from '@settlr/backend/convex/_generated/api'

// How many groups the sidebar lists; "All groups" has the rest.
const SIDEBAR_GROUPS = 6

// Gr8r Studio's sidebar row (`.sitem`): 30px, muted text and dim icons that
// brighten on hover over a raised fill; the current page is the plain
// surface lifted by a hairline and a small shadow (light) or the raised
// fill (dark).
const sideItem =
  'relative flex h-7.5 w-full items-center gap-2.25 rounded-lg px-2 text-left text-sm font-[450] whitespace-nowrap text-muted-foreground no-underline outline-none transition-colors duration-140 hover:bg-raised hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset data-[status=active]:bg-card data-[status=active]:font-medium data-[status=active]:text-foreground data-[status=active]:shadow-[0_1px_2px_rgb(0_0_0/5%),0_0_0_1px_var(--border)] dark:data-[status=active]:bg-raised dark:data-[status=active]:shadow-none [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-dim hover:[&>svg]:text-muted-foreground data-[status=active]:[&>svg]:text-muted-foreground'
// Gr8r's sidebar group heading (`.sgroup-h`): 11px, uppercase, tracked.
const sideHeading =
  'flex h-6 items-center px-2 text-2xs font-semibold tracking-[0.06em] text-faint uppercase'

/**
 * The frame around every page. Signed in, it's Gr8r Studio's shell, inset:
 * from `lg` the sidebar and the top bar (breadcrumb, bell, New, account)
 * form one frame in the sidebar's colour, which also rims the right and
 * bottom of the window, and the page sits in a rounded panel inside it
 * that scrolls on its own. The bar stays in view and content stops at the
 * panel's edge instead of sliding under it. Below
 * `lg` the sidebar becomes a drawer the top bar's menu button opens, the
 * panel fills the screen, and a tab bar runs along the bottom. Signed out, or while a new
 * account still has to give its name, it's just the site header.
 * `sidebarCollapsed` is the viewer's choice, read from a cookie on the
 * server so the first render already has the right width.
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
  const [collapsed, toggle] = useCollapsed(sidebarCollapsed)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const pathname = usePathname()

  // Following a link in the drawer closes it.
  useEffect(() => setDrawerOpen(false), [pathname])

  if (!signedIn) {
    return (
      <>
        <SiteHeader />
        <main className="app-shell">{children}</main>
      </>
    )
  }

  return (
    <div className="flex min-h-svh items-stretch bg-background lg:h-svh lg:bg-sidebar">
      <aside
        data-collapsed={collapsed || undefined}
        className={cn(
          'sticky top-0 hidden h-svh shrink-0 bg-sidebar select-none lg:block',
          collapsed ? 'w-13' : 'w-63',
        )}
      >
        <SidebarContent collapsed={collapsed} onToggle={toggle} />
      </aside>

      <DialogPrimitive.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 modal-scrim duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 lg:hidden" />
          <DialogPrimitive.Popup className="fixed inset-y-0 left-0 z-50 w-70 max-w-[calc(100vw-3rem)] border-r bg-sidebar shadow-[var(--shadow-pop)] outline-none duration-220 ease-out-quint data-open:animate-in data-open:slide-in-from-left data-closed:animate-out data-closed:slide-out-to-left lg:hidden">
            <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
            <SidebarContent collapsed={false} />
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <div className="flex min-w-0 flex-1 flex-col lg:h-svh">
        <TopBar onOpenNav={() => setDrawerOpen(true)} />
        {/* The inset panel: below the top bar, with 8px of rim to its right
            and below it (the sidebar is the frame on the left), rounded,
            and the page's scroller from `lg` (the window scrolls on
            phones). */}
        <div className="flex min-w-0 flex-1 flex-col bg-background lg:mr-2 lg:mb-2 lg:min-h-0 lg:overflow-y-auto lg:rounded-xl lg:border lg:shadow-xs">
          {/* Gr8r's page: centred, at most 1160px, on the shared 24px
              gutter (16px on phones). */}
          <main className="mx-auto w-full max-w-290 min-w-0 flex-1 px-4 pt-3 pb-28 sm:px-6 lg:pt-5 lg:pb-12">
            {children}
          </main>
        </div>
      </div>
      <BottomNav onMore={() => setDrawerOpen(true)} />
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
 * The sidebar's contents: the brand row, the sections, your groups, and
 * help, settings and your account at the foot. Collapsed (wide screens
 * only), it's a 52px rail of icons with the names in their tooltips.
 * `onToggle` is the collapse button; the drawer has none.
 */
function SidebarContent({ collapsed, onToggle }: { collapsed: boolean; onToggle?: () => void }) {
  const { data: unread = 0 } = useQuery(convexQuery(api.notifications.unreadCount, {}))
  const { data: groups } = useQuery(convexQuery(api.groups.list, {}))
  const item = cn(sideItem, collapsed && 'justify-center px-0')
  const toggleLabel = collapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'
  const label = (text: string) => <span className={cn('truncate', collapsed && 'sr-only')}>{text}</span>
  const sectionLink = (section: (typeof APP_SECTIONS)[number]) => (
    <NavLink
      key={section.to}
      href={section.to}
      exact={section.exact}
      className={item}
      title={collapsed ? section.label : undefined}
    >
      <section.icon />
      {label(section.label)}
    </NavLink>
  )

  return (
    <div className="flex h-full flex-col">
      <div className={cn('flex items-center gap-0.5 px-2 pt-2 pb-1', collapsed && 'justify-center')}>
        <Link
          href="/dashboard"
          aria-label="Settlr, dashboard"
          className={cn(
            'flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1.25 no-underline outline-none transition-colors duration-140 hover:bg-raised focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
            !collapsed && 'flex-1',
          )}
        >
          <LogoMark className="size-5.5" />
          {!collapsed && <span className="truncate text-sm font-semibold">Settlr</span>}
        </Link>
        {onToggle && !collapsed && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggle}
            aria-label={toggleLabel}
            title={toggleLabel}
          >
            <PanelLeft />
          </Button>
        )}
      </div>

      {/* Scrolls without a visible bar, which would eat width and push the
          rail's icons off centre. */}
      <nav
        aria-label="Main"
        className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-2 pt-1 pb-3 [scrollbar-width:none]"
      >
        {onToggle && collapsed && (
          <button type="button" className={item} onClick={onToggle} aria-label={toggleLabel} title={toggleLabel}>
            <PanelLeft />
          </button>
        )}
        {APP_SECTIONS.filter((section) => section.place === 'top').map(sectionLink)}
        <NavLink
          href="/notifications"
          className={item}
          title={collapsed ? 'Notifications' : undefined}
        >
          <Bell />
          {label(collapsed && unread > 0 ? `Notifications (${unread} unread)` : 'Notifications')}
          {unread > 0 &&
            (collapsed ? (
              <span
                aria-hidden="true"
                className="absolute top-1.5 right-3 size-1.5 rounded-full bg-primary"
              />
            ) : (
              <span className="ml-auto grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-2xs font-semibold text-primary-foreground tabular-nums">
                {unread > 99 ? '99+' : unread}
              </span>
            ))}
        </NavLink>

        <div
          className={cn('mt-3.5 flex flex-col', collapsed && 'mt-2.5 border-t pt-2.5')}
        >
          {!collapsed && <p className={sideHeading}>Expenses</p>}
          {APP_SECTIONS.filter((section) => section.place === 'money').map(sectionLink)}
        </div>

        <div className={cn('mt-3.5 flex flex-col', collapsed && 'mt-2.5 border-t pt-2.5')}>
          {!collapsed && (
            <div className={cn(sideHeading, 'group/heading pr-0.5')}>
              <span className="flex-1">Groups</span>
              <Link
                href="/groups/new"
                aria-label="New group"
                title="New group"
                className={cn(buttonVariants({ variant: 'ghost', size: 'icon-xs' }), 'size-5.5 sm:size-5.5')}
              >
                <Plus />
              </Link>
            </div>
          )}
          {groups?.slice(0, SIDEBAR_GROUPS).map((group) => {
            const balance =
              group.myNetCents > 0
                ? `You’re owed ${formatMoney(group.myNetCents, group.currency)}`
                : group.myNetCents < 0
                  ? `You owe ${formatMoney(-group.myNetCents, group.currency)}`
                  : 'You’re square'
            return (
              <NavLink
                key={group.id}
                href={`/groups/${group.id}`}
                title={collapsed ? `${group.name} · ${balance}` : undefined}
                className={item}
              >
                {/* Gr8r's project icon: the group's hue as a tinted tile. */}
                <span
                  aria-hidden="true"
                  className="grid size-4.5 shrink-0 place-items-center rounded-md [&_svg]:size-3"
                  style={labelTint(groupColor(group.id))}
                >
                  <Users />
                </span>
                {label(group.name)}
                {!collapsed && group.myNetCents !== 0 && (
                  <span
                    className={cn(
                      'ml-auto pl-1 text-2xs font-medium tabular-nums',
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
            [0, 1, 2].map((i) => (
              <div key={i} className={cn('flex h-7.5 items-center gap-2.25 px-2', collapsed && 'justify-center px-0')}>
                <Skeleton className="size-4.5 rounded-md" />
                {!collapsed && <Skeleton className="h-3 flex-1 rounded" />}
              </div>
            ))}
          {!collapsed && groups?.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-faint">No groups yet.</p>
          )}
          {!collapsed && groups && groups.length > SIDEBAR_GROUPS && (
            <Link href="/groups" className={cn(sideItem, 'text-ui')}>
              <Ellipsis />
              All {groups.length} groups
            </Link>
          )}
        </div>
      </nav>

      {/* minmax(0,1fr): the column stays the sidebar's width instead of
          growing to fit the account name. */}
      <div className="grid grid-cols-[minmax(0,1fr)] border-t px-2 pt-1.5 pb-2">
        <a
          href={DOCS_URL}
          target="_blank"
          rel="noreferrer"
          className={item}
          title={collapsed ? 'Help & docs' : undefined}
        >
          <CircleHelp />
          {label('Help & docs')}
        </a>
        <NavLink href="/settings" className={item} title={collapsed ? 'Settings' : undefined}>
          <Settings />
          {label('Settings')}
        </NavLink>
        {/* The theme switch is in the account menu. */}
        <AccountMenu variant={collapsed ? 'compact' : 'row'} />
      </div>
    </div>
  )
}

/**
 * Gr8r's top bar: the breadcrumb lined up with the page's gutter, then the
 * bell, the "New" menu and your avatar. Below `lg` it starts with the menu button
 * that opens the navigation drawer.
 */
function TopBar({ onOpenNav }: { onOpenNav: () => void }) {
  return (
    // On phones it sticks to the top of the window over the page, with a
    // hairline under it; from `lg` it's part of the frame, above the panel.
    <header className="sticky top-0 z-40 flex h-11.5 shrink-0 items-center gap-1.5 border-b bg-background pr-3 pl-2 sm:pl-4 lg:static lg:border-b-0 lg:bg-sidebar lg:pr-2.5 lg:pl-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        aria-label="Open navigation"
        onClick={onOpenNav}
      >
        <Menu />
      </Button>
      <Breadcrumbs />
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <NotificationBell />
        <AddMenu
          trigger={
            <Button variant="outline" size="sm" aria-label="Add expense" className="max-sm:px-2" />
          }
        >
          <Plus />
          <span className="max-sm:hidden">New</span>
          <ChevronDown className="size-3 max-sm:hidden" />
        </AddMenu>
        <span className="max-sm:hidden">
          <AccountMenu />
        </span>
      </div>
    </header>
  )
}

// Steps under a section that aren't the record itself.
const SUBPAGES: Record<string, string> = {
  new: 'New',
  edit: 'Edit',
  insights: 'Insights',
}

/**
 * Where you are: the section, then the group or friend (with the group's
 * colour), then the page within it. Names come from the same live lists the
 * sidebar reads, so they're usually already loaded.
 */
function Breadcrumbs() {
  const pathname = usePathname()
  const parts = pathname.split('/').filter(Boolean)
  const section = sectionFor(pathname)
  const inGroup = parts[0] === 'groups' && parts[1] !== undefined && parts[1] !== 'new'
  const inFriend = parts[0] === 'friends' && parts[1] !== undefined
  const { data: groups } = useQuery(convexQuery(api.groups.list, {}))
  const { data: friends } = useQuery(convexQuery(api.friends.list, inFriend ? {} : 'skip'))

  type Crumb = { label: React.ReactNode; href?: string }
  const crumbs: Array<Crumb> = []
  if (section) {
    crumbs.push({ label: section.label, href: section.to })
    if (inGroup) {
      const group = groups?.find((g) => g.id === parts[1])
      crumbs.push({
        href: `/groups/${parts[1]}`,
        label: (
          <>
            <span
              aria-hidden="true"
              className="grid size-4 shrink-0 place-items-center rounded-sm [&_svg]:size-2.5"
              style={labelTint(groupColor(parts[1]))}
            >
              <Users />
            </span>
            <span className="truncate">{group?.name ?? 'Group'}</span>
          </>
        ),
      })
      if (parts[2] === 'expenses' && parts[3] === 'new') crumbs.push({ label: 'New expense' })
      else if (parts[2] === 'expenses' && parts[4] === 'edit') crumbs.push({ label: 'Edit expense' })
      else if (parts[2] && SUBPAGES[parts[2]]) crumbs.push({ label: SUBPAGES[parts[2]] })
    } else if (parts[0] === 'groups' && parts[1] === 'new') {
      crumbs.push({ label: 'New group' })
    } else if (inFriend) {
      const friend = friends?.find((f) => f.id === parts[1])
      crumbs.push({ label: friend?.name ?? 'Friend' })
    }
  } else if (parts[0] === 'notifications') {
    crumbs.push({ label: 'Notifications' })
  } else if (parts[0] === 'settings') {
    crumbs.push({ label: 'Settings' })
  } else if (parts[0] === 'receipts') {
    crumbs.push({ label: 'Receipt' })
  }

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-2 text-ui text-muted-foreground">
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1
          return (
            <li key={i} className={cn('flex min-w-0 items-center gap-2', !last && 'max-sm:hidden')}>
              {i > 0 && (
                <span aria-hidden="true" className="text-xs text-dim max-sm:hidden">
                  /
                </span>
              )}
              {last || !crumb.href ? (
                <span
                  aria-current={last ? 'page' : undefined}
                  className={cn(
                    'flex min-w-0 items-center gap-1.5 whitespace-nowrap',
                    last && 'font-medium text-foreground',
                  )}
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="flex min-w-0 items-center gap-1.5 py-0.75 whitespace-nowrap no-underline transition-colors duration-140 hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

const tab =
  'relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg py-1.25 text-2xs text-faint no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset data-[status=active]:text-foreground [&_svg]:size-4.75'

/**
 * Narrow screens: Gr8r's flat bottom bar of sections, with More opening the
 * navigation drawer. Adding is the top bar's New button.
 */
function BottomNav({ onMore }: { onMore: () => void }) {
  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-background px-1.5 pt-1 pb-[calc(0.25rem+env(safe-area-inset-bottom))] lg:hidden"
    >
      {APP_SECTIONS.filter((section) => section.mobile).map((section) => (
        <NavLink key={section.to} href={section.to} exact={section.exact} className={tab}>
          <section.icon />
          {section.short}
        </NavLink>
      ))}
      <button type="button" className={tab} onClick={onMore}>
        <Ellipsis />
        More
      </button>
    </nav>
  )
}
