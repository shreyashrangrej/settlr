'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LayoutDashboard, LogOut, Settings } from 'lucide-react'
import { toast } from 'sonner'

import { PersonAvatar } from '#/components/ledger'
import { useSession } from '#/components/providers'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { signOut } from '#/lib/auth-client'

// The signed-in user's avatar in the header, opening a menu with their
// details, shortcuts and sign-out. Renders nothing when signed out. The user
// comes from route context, so the server and first client render agree.
export function AccountMenu() {
  const { user } = useSession()
  const router = useRouter()
  const [pending, setPending] = useState(false)

  if (!user) return null
  const label = user.name || user.email

  async function onSignOut() {
    setPending(true)
    try {
      await signOut()
      // A full page load, so nothing of this account stays in memory.
      window.location.assign('/')
    } catch {
      toast.error('Couldn’t sign out. Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-lg"
            className="rounded-full"
            aria-label="Account menu"
          />
        }
      >
        <PersonAvatar name={label} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-2.5 py-2 text-foreground">
            <PersonAvatar name={label} />
            <span className="grid min-w-0">
              {user.name && (
                <span className="truncate text-sm font-semibold">{user.name}</span>
              )}
              <span className="truncate text-xs font-normal text-muted-foreground">
                {user.email}
              </span>
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push('/dashboard')}>
            <LayoutDashboard />
            Overview
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push('/settings')}>
            <Settings />
            Settings
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={pending}
          onClick={onSignOut}
        >
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
