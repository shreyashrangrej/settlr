'use client'

import { User, Users, Wallet } from 'lucide-react'

import { useAppRouter } from '#/components/navigation-progress'
import { RobotIcon } from '#/components/robot-icon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'

const DESTINATIONS = [
  { to: '/groups', label: 'In a group', icon: Users },
  { to: '/friends', label: 'With a friend', icon: User },
  { to: '/personal', label: 'Just for me', icon: Wallet },
  { to: '/assistant', label: 'Ask the AI Assistant', icon: RobotIcon },
] as const

/**
 * "Add expense": an expense belongs to a group, a friend or yourself, so the
 * button opens a menu of where it goes. `trigger` is a Base UI `render`
 * element (e.g. a Button); `children` is its content.
 */
export function AddMenu({
  trigger,
  children,
  side,
}: {
  trigger: React.ReactElement
  children: React.ReactNode
  side?: 'top' | 'bottom'
}) {
  const router = useAppRouter()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger}>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" side={side} sideOffset={8} className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Add an expense</DropdownMenuLabel>
          {DESTINATIONS.map(({ to, label, icon: Icon }) => (
            <DropdownMenuItem key={to} onClick={() => router.push(to)}>
              <Icon className={to === '/assistant' ? 'text-primary' : undefined} />
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
