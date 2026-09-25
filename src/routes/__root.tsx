import type { ConvexQueryClient } from '@convex-dev/react-query'
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react'
import type { QueryClient } from '@tanstack/react-query'
import {
  HeadContent,
  Link,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import type { ConvexReactClient } from 'convex/react'

import { AccountMenu } from '#/components/account-menu'
import { APP_SECTIONS } from '#/components/app-nav'
import { NameForm } from '#/components/name-form'
import { ThemeToggle } from '#/components/theme-toggle'
import { buttonVariants } from '#/components/ui/button'
import { Toaster } from '#/components/ui/sonner'
import { getAuthSession } from '#/functions/auth.functions'
import { authClient } from '#/lib/auth-client'
import { themeInitScript } from '#/lib/theme'
import type { AuthUser } from '#/lib/types'
import { cn } from '#/lib/utils'

import appCss from '../styles.css?url'

// The root route renders the full HTML document on the server (`shellComponent`),
// including <head> tags collected from every matched route. The response is
// streamed: the shell flushes first and query results follow as they resolve.
export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
  convexQueryClient: ConvexQueryClient
  convexClient: ConvexReactClient
}>()({
  // Resolve the session up front so SSR renders the right signed-in state.
  beforeLoad: async ({ context }) => {
    let session: { token: string | null; user: AuthUser | null } = {
      token: null,
      user: null,
    }
    try {
      session = await getAuthSession()
    } catch (error) {
      // An unreachable auth backend shouldn't take the whole site down;
      // render signed out instead.
      console.error('Could not load the auth session', error)
    }
    // During SSR, loaders run Convex queries over HTTP as this user. (The
    // router, and so this client, is created per request.) In the browser
    // the WebSocket client gets the token from ConvexBetterAuthProvider.
    if (session.token) {
      context.convexQueryClient.serverHttpClient?.setAuth(session.token)
    }
    return { ...session, isAuthenticated: session.token !== null }
  },
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Settlr · Split shared expenses' },
      {
        name: 'description',
        content: 'Track shared expenses and settle up with the fewest payments.',
      },
    ],
    links: [
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Geist:wght@400..700&display=swap',
      },
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  shellComponent: RootDocument,
})

const navLink = cn(
  buttonVariants({ variant: 'ghost' }),
  'text-muted-foreground no-underline data-[status=active]:bg-muted data-[status=active]:text-foreground',
)

function RootDocument({ children }: { children: React.ReactNode }) {
  const { convexClient, token, user } = Route.useRouteContext()
  // New email-code accounts have no name yet. Ask for it before showing any
  // page; the header stays so they can still sign out.
  const needsName = user !== null && user.name === ''

  return (
    // The theme script adds `.dark` to <html> before hydration, so its class
    // is expected to differ from the server render.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <HeadContent />
      </head>
      <body>
        <ConvexBetterAuthProvider
          client={convexClient}
          authClient={authClient}
          initialToken={token}
        >
          <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-md">
            <div className="app-shell flex h-16 items-center justify-between gap-2">
              <Link
                to={user ? '/dashboard' : '/'}
                className="text-lg font-bold tracking-tight text-primary no-underline"
              >
                Settlr
              </Link>
              <nav className="flex items-center gap-1" aria-label="Main">
                {user && !needsName && (
                  // On small screens the app layout shows these as tabs.
                  <div className="hidden items-center gap-1 md:flex">
                    {APP_SECTIONS.map((section) => (
                      <Link
                        key={section.to}
                        to={section.to}
                        activeOptions={{ exact: section.exact }}
                        className={navLink}
                      >
                        {section.label}
                      </Link>
                    ))}
                  </div>
                )}
                {/* Signed in, Settings is in the account menu. */}
                {!user && (
                  <Link to="/settings" className={navLink}>
                    Settings
                  </Link>
                )}
                <ThemeToggle />
                <AccountMenu />
              </nav>
            </div>
          </header>
          <main className="app-shell">
            {needsName ? <NameForm email={user.email} /> : children}
          </main>
          <Toaster position="bottom-right" />
        </ConvexBetterAuthProvider>
        <Scripts />
      </body>
    </html>
  )
}
