import {
  LayoutDashboard,
  PiggyBank,
  Sparkles,
  User,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

// The signed-in area's sections, in the order the sidebar lists them. The
// mobile bar shows the ones marked `mobile`; the rest are in the account menu.
export const APP_SECTIONS: ReadonlyArray<{
  to: string
  label: string
  /** The shorter name under the icon in the mobile bar. */
  short: string
  icon: LucideIcon
  exact: boolean
  mobile: boolean
}> = [
  { to: '/dashboard', label: 'Dashboard', short: 'Home', icon: LayoutDashboard, exact: true, mobile: true },
  { to: '/groups', label: 'Groups', short: 'Groups', icon: Users, exact: false, mobile: true },
  { to: '/friends', label: 'Friends', short: 'Friends', icon: User, exact: false, mobile: true },
  { to: '/personal', label: 'Personal', short: 'Personal', icon: Wallet, exact: false, mobile: true },
  { to: '/budget', label: 'Budget', short: 'Budget', icon: PiggyBank, exact: false, mobile: false },
  { to: '/assistant', label: 'Assistant', short: 'Assistant', icon: Sparkles, exact: false, mobile: false },
]
