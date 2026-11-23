import {
  LayoutDashboard,
  PiggyBank,
  ReceiptText,
  User,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

import { RobotIcon } from '#/components/robot-icon'

// The signed-in area's sections, in the order the sidebar lists them:
// `top` ones sit at the head of the sidebar, `money` ones under its
// "Expenses" heading (like Gr8r Studio's top items and its Workspace
// group). The mobile tab bar shows the ones marked `mobile`; the rest are in
// the navigation drawer.
export const APP_SECTIONS: ReadonlyArray<{
  to: string
  label: string
  /** The shorter name under the icon in the mobile bar. */
  short: string
  icon: LucideIcon
  exact: boolean
  mobile: boolean
  place: 'top' | 'money'
}> = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    short: 'Home',
    icon: LayoutDashboard,
    exact: true,
    mobile: true,
    place: 'top',
  },
  {
    to: '/assistant',
    label: 'AI Assistant',
    short: 'AI Assistant',
    icon: RobotIcon,
    exact: false,
    mobile: false,
    place: 'top',
  },
  {
    to: '/expenses',
    label: 'All expenses',
    short: 'Expenses',
    icon: ReceiptText,
    exact: false,
    mobile: false,
    place: 'money',
  },
  { to: '/groups', label: 'Groups', short: 'Groups', icon: Users, exact: false, mobile: true, place: 'money' },
  { to: '/friends', label: 'Friends', short: 'Friends', icon: User, exact: false, mobile: true, place: 'money' },
  {
    to: '/personal',
    label: 'Personal',
    short: 'Personal',
    icon: Wallet,
    exact: false,
    mobile: true,
    place: 'money',
  },
  {
    to: '/budget',
    label: 'Budget',
    short: 'Budget',
    icon: PiggyBank,
    exact: false,
    mobile: false,
    place: 'money',
  },
]

/** The section a path belongs to, for the breadcrumb's first step. */
export function sectionFor(pathname: string) {
  return APP_SECTIONS.find(
    (section) => pathname === section.to || pathname.startsWith(`${section.to}/`),
  )
}
