# Settlr

Split shared expenses with friends, flatmates or trips, and settle up with the
fewest payments. Built with [TanStack Start](https://tanstack.com/start)
(React, file-based TanStack Router, Vite, Nitro), [Convex](https://convex.dev)
for data, [Better Auth](https://better-auth.com) for sign-in and
[shadcn/ui](https://ui.shadcn.com) on [Base UI](https://base-ui.com) for the
interface.

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm dev:convex   # push convex/ to your dev deployment on every change
pnpm typecheck
pnpm build        # outputs .output/ for the selected runtime
pnpm start        # runs the node-server build
```

## What it does

After signing in (Google, or a one-time code by email) people land on an
overview of these areas:

- **Friends**: one-on-one expenses with a single person, outside any group.
  Each expense is split equally or owed in full by the other person, and
  "Settle up" records payments. Balances are kept per currency. Add a
  friend's email to send them a friend request; once they accept, you both
  see the same ledger (each from your own side) and get notified of new
  entries.
- **Groups**: trips, flats and dinners with up to 20 members (you are always
  one of them). Expenses are split equally between chosen members, balances
  are worked out to the cent, and a settle-up plan uses the fewest payments.
  Groups can be renamed and members added, renamed or removed (removing is
  only allowed for people who aren't on any expense, and the currency only
  changes while a group has no expenses).
- **Personal**: your own spending, month by month, with totals by category.
- **Budget**: an optional monthly budget per currency, on its own page
  because it counts everything you spend: personal expenses plus your share
  of friend and group expenses (progress, what's left, a daily allowance for
  the rest of the month, and where the money went).
- **Notifications**: friend requests to accept or decline, and a note
  whenever someone adds or edits an expense that involves you, records a
  payment with you, adds you to a group or accepts your request. The bell
  shows the count and opens a dropdown with the latest ones; "More" opens the
  full list.

Every expense can be edited after it's added (a linked friend's copy and
group balances follow), and can carry a **receipt**: an image (JPEG, PNG,
WebP, GIF) or PDF up to 10 MB, kept in Convex file storage. Clicking the
paperclip opens it in an in-app viewer. Dates are picked with shadcn's
calendar.

Friends and group members are people you track by name; they don't need an
account. A group's owner can link members to friends who have accepted a
friend request; linked members see the group, can add expenses and are
notified, but only the owner can edit or delete it.

## Project layout

```
convex/                    backend: schema, queries and mutations
  schema.ts                tables and indexes
  friends.ts groups.ts personal.ts budgets.ts notifications.ts
  receipts.ts              receipt uploads (Convex file storage) and viewing
  lib/                     auth helper, input checks, balance math, receipts
  auth.ts http.ts          Better Auth running inside Convex
src/
  routes/                  file-based routes (routeTree.gen.ts is generated)
    _app.tsx               signed-in layout; redirects signed-out visitors
    _app/                  dashboard, friends, groups, personal, budget,
                           notifications, receipts/$source/$expenseId
  functions/               server functions (the auth session for SSR)
  server/                  server-only code (Better Auth proxy and token)
  lib/                     isomorphic code: zod schemas, types, formatting,
                           client-only preferences
  components/              app components; shadcn/ui (Base UI) in components/ui
  start.ts                 global request middleware (CSRF)
  router.tsx               router, TanStack Query and Convex clients
```

## How it's built

**Convex, through TanStack Query.** `src/router.tsx` connects a
`ConvexQueryClient` to TanStack Query. Route loaders prefetch Convex queries
with `queryClient.ensureQueryData(convexQuery(api.x.y, args))`, and
components read them with `useSuspenseQuery`. During SSR those queries run
over HTTP with the visitor's auth token (set in the root route's
`beforeLoad`), and the results are dehydrated into the HTML. In the browser
each query becomes a live WebSocket subscription, so pages update themselves
after a mutation or a change in another tab: there is no refetching or
`router.invalidate()`. Mutations are called with `useConvexMutation`.

**Precomputed totals.** Friend balances, group member totals, and group
category and month totals live on the friend or group document and are
updated in the same mutation as each expense or payment
(`convex/lib/ledger.ts`). Pages that show balances read one document instead
of summing a ledger.

**Validation on both sides.** Forms validate with the zod schemas in
`src/lib/schemas.ts`. Convex functions check argument types with validators
and values with `convex/lib/input.ts` (same limits), and derive the user from
the auth token, never from arguments.

**Validated search params.** A group's expense filters, sort order and list
length live in the URL (`?category=food&sort=amount&limit=40`). They are
validated by zod schemas; invalid values fall back to defaults instead of
throwing, and `stripSearchParams` removes defaults so URLs stay clean.
`loaderDeps` re-runs the loader only when those params change. Lists grow
with "Show more" rather than page numbers.

**Server-only boundaries.** `*.server.ts` files are blocked from the client
bundle by Start's import protection; a violation fails `pnpm build`.
`createClientOnlyFn` guards the localStorage preferences in
`src/lib/preferences.ts`. POST server functions are protected by the CSRF
request middleware in `src/start.ts`.

### SSR mode per route

| Route                                  | `ssr`         | Why                                                                                                                                            |
| -------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `/` (landing hero)                     | `true`        | Marketing page and sign-in form. Signed-in visitors are redirected to `/dashboard`.                                                           |
| `/dashboard`, `/friends`, `/personal`, `/budget` | `true` | Queries are prefetched on the server with the visitor's token, so the first HTML is complete.                                         |
| `/groups/$groupId` (+ expenses)        | `true`        | Shareable, filterable URLs render fully on the server. Adding and editing an expense are pages under it.                                       |
| `/receipts/$source/$expenseId`         | `true`        | The receipt's URL and its expense are prefetched; images show inline and PDFs in the browser's viewer.                                         |
| `/notifications`                       | `'data-only'` | The full list behind the bell's "More". Times are relative to the viewer's clock, so it renders in the browser.                                |
| `/groups/$groupId/insights`            | `'data-only'` | The data is prefetched on the server, but the UI uses the viewer's locale, time zone and clock, so it renders only in the browser.            |
| `/settings`                            | `false`       | Preferences live in localStorage, so the loader and UI can only run in the browser.                                                           |
| `/api/health`                          | server route  | JSON liveness probe for load balancers and platform health checks.                                                                           |

For `false` and `'data-only'` routes, the server renders the router's
`defaultPendingComponent` in place of the route component.

## Deployment

The server is packaged by [Nitro](https://nitro.build) (`nitro()` in
`vite.config.ts`). The target runtime is chosen at build time, and the
application code stays the same:

```bash
pnpm build                                  # node-server (default) → pnpm start
NITRO_PRESET=vercel pnpm build
NITRO_PRESET=netlify pnpm build
NITRO_PRESET=cloudflare-module pnpm build
NITRO_PRESET=bun pnpm build
```

Deploy the backend with `pnpm exec convex deploy`, and set `VITE_CONVEX_URL`
and `VITE_CONVEX_SITE_URL` for the web build.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and the
[code of conduct](CODE_OF_CONDUCT.md).
