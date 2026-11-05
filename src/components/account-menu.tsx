'use client'

import { useState } from 'react'
import { ChevronsUpDown, LogOut, Moon, Settings, Sun } from 'lucide-react'
import { toast } from 'sonner'

import { APP_SECTIONS } from '#/components/app-nav'
import { PersonAvatar } from '#/components/ledger'
import { useAppRouter } from '#/components/navigation-progress'
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
import { applyTheme } from '#/lib/theme'

// The signed-in user's menu, with their details, shortcuts and sign-out.
// `row` is the sidebar's footer (avatar and name); `avatar` is the round
// button in the top bar, whose menu also has the sections the mobile bar has
// no room for and the theme switch. Renders nothing when signed out. The
// user comes from the root layout, so the server and first client render
// agree.
export function AccountMenu({ variant = 'avatar' }: { variant?: 'avatar' | 'row' }) {
  const { user } = useSession()
  const router = useAppRouter()
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
      {variant === 'row' ? (
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label="Account menu"
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-2 text-left outline-none hover:bg-tile focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-tile"
            />
          }
        >
          <PersonAvatar name={label} me className="size-9" />
          {/* The email is in the menu; the row only has room for the name. */}
          <span className="min-w-0 flex-1 truncate font-semibold">
            {user.name || 'Your account'}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
      ) : (
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
          <PersonAvatar name={label} me size="lg" />
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent align={variant === 'row' ? 'start' : 'end'} className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-2.5 py-2 text-foreground">
            <PersonAvatar name={label} me />
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
          {variant === 'avatar' &&
            APP_SECTIONS.filter((section) => !section.mobile).map((section) => (
              <DropdownMenuItem key={section.to} onClick={() => router.push(section.to)}>
                <section.icon />
                {section.label}
              </DropdownMenuItem>
            ))}
          <DropdownMenuItem onClick={() => router.push('/settings')}>
            <Settings />
            Settings
          </DropdownMenuItem>
          {/* The top bar has no theme button. Both labels render and the
              `dark:` variant picks one, so server and client agree. */}
          {variant === 'avatar' && (
            <DropdownMenuItem
              closeOnClick={false}
              onClick={() =>
                applyTheme(
                  document.documentElement.classList.contains('dark') ? 'light' : 'dark',
                )
              }
            >
              <Moon className="dark:hidden" />
              <Sun className="hidden dark:block" />
              <span className="dark:hidden">Dark mode</span>
              <span className="hidden dark:inline">Light mode</span>
            </DropdownMenuItem>
          )}
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
