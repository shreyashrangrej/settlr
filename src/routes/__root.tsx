import {
  HeadContent,
  Link,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'

import appCss from '../styles.css?url'

// The root route renders the full HTML document on the server (`shellComponent`),
// including <head> tags collected from every matched route. The response is
// streamed: the shell flushes first and deferred loader data follows as it
// resolves.
export const Route = createRootRoute({
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
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <header className="site-header">
          <div className="container site-header__inner">
            <Link to="/" className="brand">
              Settlr
            </Link>
            <nav className="site-nav">
              <Link to="/" activeOptions={{ exact: true }}>
                Groups
              </Link>
              <Link to="/settings">Settings</Link>
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
        <Scripts />
      </body>
    </html>
  )
}
