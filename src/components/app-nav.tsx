import { Link } from '@tanstack/react-router'

import { cn } from '#/lib/utils'

// The signed-in area's sections. The header shows them on wide screens and
// the app layout shows them as tabs on narrow ones.
export const APP_SECTIONS = [
  { to: '/dashboard', label: 'Overview', exact: true },
  { to: '/friends', label: 'Friends', exact: false },
  { to: '/groups', label: 'Groups', exact: false },
  { to: '/personal', label: 'Personal', exact: false },
] as const

export function AppTabs({ className }: { className?: string }) {
  return (
    <nav
      aria-label="Sections"
      className={cn('-mx-1 flex gap-1 overflow-x-auto pb-1', className)}
    >
      {APP_SECTIONS.map((section) => (
        <Link
          key={section.to}
          to={section.to}
          activeOptions={{ exact: section.exact }}
          className="shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium text-muted-foreground no-underline data-[status=active]:border-primary data-[status=active]:bg-primary data-[status=active]:text-primary-foreground"
        >
          {section.label}
        </Link>
      ))}
    </nav>
  )
}
