import { Link } from '@tanstack/react-router'

import { buttonVariants } from '#/components/ui/button'
import { cn } from '#/lib/utils'

// The signed-in area's sections. The header shows them on wide screens and
// the app layout shows them as tabs on narrow ones.
export const APP_SECTIONS = [
  { to: '/dashboard', label: 'Overview', exact: true },
  { to: '/friends', label: 'Friends', exact: false },
  { to: '/groups', label: 'Groups', exact: false },
  { to: '/personal', label: 'Personal', exact: false },
  { to: '/budget', label: 'Budget', exact: false },
] as const

export function AppTabs({ className }: { className?: string }) {
  return (
    <nav
      aria-label="Sections"
      className={cn(
        '-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]',
        className,
      )}
    >
      {APP_SECTIONS.map((section) => (
        <Link
          key={section.to}
          to={section.to}
          activeOptions={{ exact: section.exact }}
          className={cn(
            buttonVariants({ variant: 'outline' }),
            // Repeated under dark: to beat the outline variant's dark styles.
            'shrink-0 rounded-full px-3.5 no-underline data-[status=active]:border-primary data-[status=active]:bg-primary data-[status=active]:text-primary-foreground dark:data-[status=active]:border-primary dark:data-[status=active]:bg-primary',
          )}
        >
          {section.label}
        </Link>
      ))}
    </nav>
  )
}
