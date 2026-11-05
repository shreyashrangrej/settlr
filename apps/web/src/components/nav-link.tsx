'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * A link that knows when it's the current page: it gets
 * `data-status="active"` (style it with `data-[status=active]:`) and
 * `aria-current="page"`. `exact` matches only this path; otherwise nested
 * paths count too (/groups is active on /groups/abc).
 */
export function NavLink({
  href,
  exact = false,
  ...props
}: React.ComponentProps<typeof Link> & { href: string; exact?: boolean }) {
  const pathname = usePathname()
  const active = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`)
  return (
    <Link
      href={href}
      data-status={active ? 'active' : undefined}
      aria-current={active ? 'page' : undefined}
      {...props}
    />
  )
}
