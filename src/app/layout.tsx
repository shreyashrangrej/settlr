import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'

import { NameForm } from '#/components/name-form'
import { NavigationProgress } from '#/components/navigation-progress'
import { Providers } from '#/components/providers'
import { SiteHeader } from '#/components/site-header'
import { Toaster } from '#/components/ui/sonner'
import { themeInitScript } from '#/lib/theme'
import { getAuthSession } from '#/server/auth.server'

import '#/styles.css'

export const metadata: Metadata = {
  title: 'Settlr · Split shared expenses',
  description: 'Track shared expenses and settle up with the fewest payments.',
  icons: { icon: { url: '/favicon.svg', type: 'image/svg+xml' } },
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1 }

// The root layout renders the whole document on the server for every
// request. It resolves the auth session first, so SSR renders the right
// signed-in state (and the Convex client starts with the token). It isn't
// rendered again on client-side navigation; `router.refresh()` does.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getAuthSession()
  const { user } = session
  // New email-code accounts have no name yet. Ask for it before showing any
  // page; the header stays so they can still sign out.
  const needsName = user !== null && user.name === ''

  return (
    // The theme script adds `.dark` to <html> before hydration, so its class
    // is expected to differ from the server render.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400..700&display=swap"
        />
      </head>
      <body>
        {/* It reads the search params, which needs a Suspense boundary. */}
        <Suspense>
          <NavigationProgress />
        </Suspense>
        <Providers session={session}>
          <SiteHeader />
          <main className="app-shell">
            {needsName ? <NameForm email={user.email} /> : children}
          </main>
          <Toaster position="bottom-right" />
        </Providers>
      </body>
    </html>
  )
}
